import mongoose from "mongoose";

export const revokeTokenSchema = new mongoose.Schema(
  {
    tokenid: { type: String, required: true, trim: true },
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expireAt: Date,
  },
  { timestamps: true, strict: true, strictQuery: true }
);

revokeTokenSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const revokeTokenModel =
  mongoose.models.revokeToken ||
  mongoose.model("revokeToken", revokeTokenSchema);

export default revokeTokenModel;