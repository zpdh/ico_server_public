import mongoose, { Model, Schema } from "mongoose";

interface IUser extends Document {
    username: String;
    uuid: String;
    aspects: Number;
    raids: Number;
    blocked: [String];
}

// TODO: figure out how to make collation default without having to add it to each request
const userSchema: Schema<IUser> = new Schema({
    username: { type: String, required: false },
    uuid: { type: String, required: true },
    aspects: { type: Number, required: true, default: 0 },
    raids: { type: Number, required: true, default: 0 },
    blocked: { type: [String], required: true, default: [] },
});

const UserModel: Model<IUser> = mongoose.model("User", userSchema);

export default UserModel;
