


export enum GenderEnum{
    male="male",
    female="female"
}
export enum RoleEnum{
    user="user",
    admin="admin"
}
// How the account was created: email + password, or Google sign-in
export enum ProviderEnum {
    system = "system",
    google = "google"
}

// pending  -> follow request sent to a private account, waiting for approval
// accepted -> the follower is allowed to see the account / its content
export enum FollowStatusEnum {
    pending = "pending",
    accepted = "accepted"
}