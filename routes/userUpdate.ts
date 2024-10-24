import { Request, Response, Router } from "express";
import validateJwtToken from "../security/jwtTokenValidator.js";
import updateAspects from "../sockets/updateAspects.js";
import UserModel from "../models/userModel.js";
import { UUIDtoUsername } from "../services/ConvertMinecraftUser.js";

/**Maps all endpoints related to updating user information. */
const userUpdateRouter = Router();
userUpdateRouter.use(validateJwtToken);

userUpdateRouter.post("/aspects", async (request: Request<{}, {}, { username: string }>, response: Response) => {
    try {
        const username = request.body.username;
        await updateAspects(username);
        response.send();
    } catch (error) {
        console.log("update aspects error:", error);
        response.status(500).send({ error: "something went wrong" });
    }
});

userUpdateRouter.get("/blocked/:uuid", async (request: Request<{ uuid: string }, {}, {}>, response: Response) => {
    try {
        const uuid = request.params.uuid.replaceAll("-", "");
        const user = await UserModel.findOne(
            { uuid: uuid },
            { blocked: true },
            { collation: { locale: "en", strength: 2 } }
        );
        if (!user) {
            response.status(404).send({ error: "user not found" });
            return;
        }
        response.send(user.blocked);
    } catch (error) {
        console.log("get blocked error:", error);
        response.status(500).send({ error: "something went wrong" });
    }
});

userUpdateRouter.post(
    "/blocked/:uuid",
    async (request: Request<{ uuid: string }, {}, { toBlock: string }>, response: Response) => {
        try {
            const toBlock = request.body.toBlock;
            const uuid = request.params.uuid.replaceAll("-", "");
            await UserModel.updateOne(
                { uuid: uuid },
                { username: await UUIDtoUsername(uuid), $push: { blocked: toBlock } },
                { upsert: true, collation: { locale: "en", strength: 2 } }
            );
            response.send({ error: "" });
        } catch (error) {
            console.log("update blocked error:", error);
            response.status(500).send({ error: "something went wrong" });
        }
    }
);

export default userUpdateRouter;