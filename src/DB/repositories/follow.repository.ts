import { Model } from "mongoose";
import followModel, { IFollow } from "../models/follow.model.js";
import { DBRepository } from "./db.repository.js";


export class FollowRepository extends DBRepository<IFollow> {

    constructor(model: Model<IFollow> = followModel) {
        super(model)
    }

}