import { type NextFunction, type Request, type Response } from "express";
import { Types } from "mongoose";
import { AppError } from "../../common/utils/globalErrorHandling.js";
import { UserRepository } from "../../DB/repositories/user.repository.js";
import { FollowRepository } from "../../DB/repositories/follow.repository.js";
import { FollowStatusEnum, ProviderEnum } from "../../common/enum/user.enum.js";
import { Compare, Hash } from "../../common/security/hash.js";
import { credentialChangeDate } from "../../common/service/token.service.js";

const PUBLIC_FIELDS = "fName lName profileImage isPrivate"

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const getPagination = (query: Request["query"]) => {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
    return { page, limit, skip: (page - 1) * limit }
}

class UserService {

    private readonly _userRepo = new UserRepository()
    private readonly _followRepo = new FollowRepository()

    // ───────────────────────── helpers ─────────────────────────

    private followersCount = (userId: Types.ObjectId) =>
        this._followRepo.countDocuments({ following: userId, status: FollowStatusEnum.accepted })

    private followingCount = (userId: Types.ObjectId) =>
        this._followRepo.countDocuments({ follower: userId, status: FollowStatusEnum.accepted })

    // relationship between the person who is logged in (viewer) and another user
    private followStatus = async (viewerId: Types.ObjectId, targetId: Types.ObjectId) => {
        const follow = await this._followRepo.findOne({ filter: { follower: viewerId, following: targetId } })
        return follow?.status ?? null
    }

    // find a user that is allowed to appear in the app (email verified)
    private getActiveUser = async (id: string) => {
        const user = await this._userRepo.findOne({ filter: { _id: id, isConfirmed: true } })
        if (!user) throw new AppError("User not found", 404)
        return user
    }

    // private accounts show their followers/following only to the owner and approved followers
    private canViewPrivateData = async (viewerId: Types.ObjectId, target: { _id: Types.ObjectId, isPrivate: boolean }) => {
        if (!target.isPrivate || viewerId.equals(target._id)) return true
        return (await this.followStatus(viewerId, target._id)) === FollowStatusEnum.accepted
    }

    // adds `followStatus` (none | pending | accepted) to a list of users
    private withFollowStatus = async (viewerId: Types.ObjectId, users: any[]) => {
        const follows = await this._followRepo.find({
            filter: { follower: viewerId, following: { $in: users.map((u) => u._id) } }
        })
        const statusById = new Map(follows.map((f) => [f.following.toString(), f.status]))

        return users.map((u) => ({
            id: u._id,
            fName: u.fName,
            lName: u.lName,
            profileImage: u.profileImage,
            isPrivate: u.isPrivate,
            followStatus: statusById.get(u._id.toString()) ?? "none",
            ...(u.mutualCount ? { mutualFollowers: u.mutualCount } : {})
        }))
    }

    // ───────────────────────── 1) Profile retrieval & updates ─────────────────────────

    getMe = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!

        const [followers, following, pendingRequests] = await Promise.all([
            this.followersCount(me._id),
            this.followingCount(me._id),
            this._followRepo.countDocuments({ following: me._id, status: FollowStatusEnum.pending }),
        ])

        res.status(200).json({
            success: true,
            user: { ...me.toJSON(), followersCount: followers, followingCount: following, pendingRequestsCount: pendingRequests }
        })
    }

    updateMe = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!

        // body is already validated (strict): only fName, lName, phone, gender, bio can arrive here
        me.set(req.body)
        await me.save()

        res.status(200).json({ success: true, message: "Profile updated", user: me })
    }

    getProfile = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!
        const id = String(req.params.id)

        // opening my own id = my own profile
        if (me._id.toString() === id) return this.getMe(req, res, next)

        const user = await this.getActiveUser(id)
        const [status, followers, following] = await Promise.all([
            this.followStatus(me._id, user._id),
            this.followersCount(user._id),
            this.followingCount(user._id),
        ])
        const canView = !user.isPrivate || status === FollowStatusEnum.accepted

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                fName: user.fName,
                lName: user.lName,
                profileImage: user.profileImage,
                isPrivate: user.isPrivate,
                followersCount: followers,
                followingCount: following,
                followStatus: status ?? "none",
                canViewProfile: canView,
                // private profile: strangers only see the basic card above
                ...(canView ? { bio: user.bio, gender: user.gender, joinedAt: (user as any).createdAt } : {})
            }
        })
    }

    // ───────────────────────── 2) Follow / Unfollow ─────────────────────────

    follow = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!
        const target = await this.getActiveUser(String(req.params.id))

        if (me._id.equals(target._id)) throw new AppError("You can't follow yourself", 400)

        const existing = await this.followStatus(me._id, target._id)
        if (existing === FollowStatusEnum.accepted) throw new AppError("You already follow this user", 409)
        if (existing === FollowStatusEnum.pending) throw new AppError("Follow request already sent", 409)

        // public account -> follow immediately, private account -> the owner must accept first
        const status = target.isPrivate ? FollowStatusEnum.pending : FollowStatusEnum.accepted
        await this._followRepo.create({ follower: me._id, following: target._id, status })

        res.status(201).json({
            success: true,
            status,
            message: status === FollowStatusEnum.pending ? "Follow request sent" : "You are now following this user"
        })
    }

    // also cancels a pending request
    unfollow = async (req: Request, res: Response, next: NextFunction) => {
        const deleted = await this._followRepo.findOneAndDelete({
            filter: { follower: req.user!._id, following: String(req.params.id) as any }
        })
        if (!deleted) throw new AppError("You are not following this user", 404)

        res.status(200).json({
            success: true,
            message: deleted.status === FollowStatusEnum.pending ? "Follow request cancelled" : "Unfollowed successfully"
        })
    }

    listFollowers = async (req: Request, res: Response, next: NextFunction) => {
        const target = await this.getActiveUser(String(req.params.id))
        if (!(await this.canViewPrivateData(req.user!._id, target))) throw new AppError("This account is private", 403)

        const { page, limit, skip } = getPagination(req.query)
        const filter = { following: target._id, status: FollowStatusEnum.accepted }

        const [follows, total] = await Promise.all([
            this._followRepo.find({
                filter,
                options: { skip, limit, sort: { createdAt: -1 }, populate: { path: "follower", select: PUBLIC_FIELDS } }
            }),
            this._followRepo.countDocuments(filter),
        ])

        res.status(200).json({ success: true, page, limit, total, users: follows.map((f) => f.follower) })
    }

    listFollowing = async (req: Request, res: Response, next: NextFunction) => {
        const target = await this.getActiveUser(String(req.params.id))
        if (!(await this.canViewPrivateData(req.user!._id, target))) throw new AppError("This account is private", 403)

        const { page, limit, skip } = getPagination(req.query)
        const filter = { follower: target._id, status: FollowStatusEnum.accepted }

        const [follows, total] = await Promise.all([
            this._followRepo.find({
                filter,
                options: { skip, limit, sort: { createdAt: -1 }, populate: { path: "following", select: PUBLIC_FIELDS } }
            }),
            this._followRepo.countDocuments(filter),
        ])

        res.status(200).json({ success: true, page, limit, total, users: follows.map((f) => f.following) })
    }

    // requests sent to MY private account
    listFollowRequests = async (req: Request, res: Response, next: NextFunction) => {
        const { page, limit, skip } = getPagination(req.query)
        const filter = { following: req.user!._id, status: FollowStatusEnum.pending }

        const [requests, total] = await Promise.all([
            this._followRepo.find({
                filter,
                options: { skip, limit, sort: { createdAt: -1 }, populate: { path: "follower", select: PUBLIC_FIELDS } }
            }),
            this._followRepo.countDocuments(filter),
        ])

        res.status(200).json({ success: true, page, limit, total, requests: requests.map((r) => r.follower) })
    }

    acceptFollowRequest = async (req: Request, res: Response, next: NextFunction) => {
        const request = await this._followRepo.findOneAndUpdate({
            filter: { follower: String(req.params.id) as any, following: req.user!._id, status: FollowStatusEnum.pending },
            update: { status: FollowStatusEnum.accepted }
        })
        if (!request) throw new AppError("Follow request not found", 404)

        res.status(200).json({ success: true, message: "Follow request accepted" })
    }

    rejectFollowRequest = async (req: Request, res: Response, next: NextFunction) => {
        const request = await this._followRepo.findOneAndDelete({
            filter: { follower: String(req.params.id) as any, following: req.user!._id, status: FollowStatusEnum.pending }
        })
        if (!request) throw new AppError("Follow request not found", 404)

        res.status(200).json({ success: true, message: "Follow request rejected" })
    }

    // ───────────────────────── 3) Search & suggestions ─────────────────────────

    // GET /users/search?q=john doe&page=1&limit=10
    search = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!
        const { page, limit, skip } = getPagination(req.query)

        // every word typed must match the first OR last name ("john do" finds John Doe)
        const terms = String(req.query.q).trim().split(/\s+/).filter(Boolean).slice(0, 3)
        const filter = {
            _id: { $ne: me._id },
            isConfirmed: true,
            $and: terms.map((term) => {
                const regex = new RegExp(escapeRegex(term), "i") // escaped: users can't inject regex
                return { $or: [{ fName: regex }, { lName: regex }] }
            })
        }

        const [users, total] = await Promise.all([
            this._userRepo.find({ filter, options: { skip, limit, sort: { fName: 1, lName: 1 }, select: PUBLIC_FIELDS } }),
            this._userRepo.countDocuments(filter),
        ])

        res.status(200).json({ success: true, page, limit, total, users: await this.withFollowStatus(me._id, users) })
    }

    // People you may know = accounts followed by the people I follow (most mutual followers first),
    // then filled with the newest users if there aren't enough.
    suggestions = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!
        const { limit } = getPagination(req.query)

        const myFollows = await this._followRepo.find({ filter: { follower: me._id } })
        const acceptedIds = myFollows.filter((f) => f.status === FollowStatusEnum.accepted).map((f) => f.following)
        const excludeIds = [me._id, ...myFollows.map((f) => f.following)] // me + everyone I already follow / requested

        const mutual = acceptedIds.length === 0 ? [] : await this._followRepo.aggregate<{ _id: Types.ObjectId, mutualCount: number }>([
            { $match: { follower: { $in: acceptedIds }, status: FollowStatusEnum.accepted, following: { $nin: excludeIds } } },
            { $group: { _id: "$following", mutualCount: { $sum: 1 } } },
            { $sort: { mutualCount: -1, _id: 1 } },
            { $limit: limit },
        ])

        const mutualCountById = new Map(mutual.map((m) => [m._id.toString(), m.mutualCount]))
        const mutualUsers = mutual.length === 0 ? [] : await this._userRepo.find({
            filter: { _id: { $in: mutual.map((m) => m._id) }, isConfirmed: true },
            options: { select: PUBLIC_FIELDS }
        })
        const suggested: any[] = mutualUsers
            .map((u) => ({ ...u.toJSON(), _id: u._id, mutualCount: mutualCountById.get(u._id.toString()) ?? 0 }))
            .sort((a, b) => b.mutualCount - a.mutualCount)

        if (suggested.length < limit) {
            const fill = await this._userRepo.find({
                filter: { _id: { $nin: [...excludeIds, ...suggested.map((s) => s._id)] }, isConfirmed: true },
                options: { limit: limit - suggested.length, sort: { createdAt: -1 }, select: PUBLIC_FIELDS }
            })
            suggested.push(...fill)
        }

        res.status(200).json({ success: true, users: await this.withFollowStatus(me._id, suggested) })
    }

    // ───────────────────────── 4) Account settings & privacy ─────────────────────────

    // body: { isPrivate: true | false }
    updatePrivacy = async (req: Request, res: Response, next: NextFunction) => {
        const me = req.user!
        const { isPrivate } = req.body

        me.isPrivate = isPrivate
        await me.save()

        // Going public means nobody has to wait for approval anymore -> accept all pending requests
        let approved = 0
        if (!isPrivate) {
            const result = await this._followRepo.updateMany({
                filter: { following: me._id, status: FollowStatusEnum.pending },
                update: { status: FollowStatusEnum.accepted }
            })
            approved = result.modifiedCount
        }

        res.status(200).json({
            success: true,
            message: `Your account is now ${isPrivate ? "private" : "public"}`,
            isPrivate,
            ...(approved ? { pendingRequestsApproved: approved } : {})
        })
    }

    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        const { oldPassword, password } = req.body

        const user = await this._userRepo.findOne({ filter: { _id: req.user!._id }, projection: "+password" })
        if (!user) throw new AppError("User not found", 404)
        if (user.provider !== ProviderEnum.system || !user.password) {
            throw new AppError("This account uses Google sign-in and has no password", 400)
        }
        if (!(await Compare(oldPassword, user.password))) throw new AppError("Old password is incorrect", 400)

        user.password = await Hash(password)
        user.changeCredentialAt = credentialChangeDate() // every existing session is logged out
        await user.save()

        res.status(200).json({ success: true, message: "Password changed, please login again" })
    }
}


export default new UserService()