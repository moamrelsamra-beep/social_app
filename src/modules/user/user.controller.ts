import { Router } from "express";
import US from "./user.service.js";
import { Validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authentication.js";
import {
    changePasswordSchema,
    idSchema,
    idWithPaginationSchema,
    paginationSchema,
    privacySchema,
    searchSchema,
    updateProfileSchema,
} from "./user.validation.js";

const userRouter = Router();

// every route in this module needs a logged-in user
userRouter.use(authentication);

// my account  (must be declared BEFORE "/:id")
userRouter.get("/me", US.getMe);
userRouter.patch("/me", Validation(updateProfileSchema), US.updateMe);
userRouter.patch("/me/privacy", Validation(privacySchema), US.updatePrivacy);
userRouter.patch("/me/password", Validation(changePasswordSchema), US.changePassword);

// discovery
userRouter.get("/search", Validation(searchSchema), US.search);
userRouter.get("/suggestions", Validation(paginationSchema), US.suggestions);

// follow requests (for private accounts)
userRouter.get("/follow-requests", Validation(paginationSchema), US.listFollowRequests);
userRouter.patch("/follow-requests/:id/accept", Validation(idSchema), US.acceptFollowRequest);
userRouter.delete("/follow-requests/:id", Validation(idSchema), US.rejectFollowRequest);

// other users
userRouter.get("/:id", Validation(idSchema), US.getProfile);
userRouter.post("/:id/follow", Validation(idSchema), US.follow);
userRouter.delete("/:id/follow", Validation(idSchema), US.unfollow);
userRouter.get("/:id/followers", Validation(idWithPaginationSchema), US.listFollowers);
userRouter.get("/:id/following", Validation(idWithPaginationSchema), US.listFollowing);

export default userRouter;