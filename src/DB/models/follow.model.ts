import mongoose from "mongoose";
import { FollowStatusEnum } from "../../common/enum/user.enum";

export interface IFollow {
    follower: mongoose.Types.ObjectId;   // the user who follows
    following: mongoose.Types.ObjectId;  // the user being followed
    status: FollowStatusEnum;
}

const followSchema = new mongoose.Schema<IFollow>({
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: FollowStatusEnum, default: FollowStatusEnum.accepted }
}, { timestamps: true, strictQuery: true })

// a user can follow another user only once
followSchema.index({ follower: 1, following: 1 }, { unique: true })
// fast "who follows X" lookups and counters
followSchema.index({ following: 1, status: 1 })

const followModel = (mongoose.models.Follow || mongoose.model<IFollow>("Follow", followSchema)) as mongoose.Model<IFollow>

export default followModel