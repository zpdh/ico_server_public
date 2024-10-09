import { Request, Response, Router } from "express";
import UserModel from "../models/userModel.js";
import validateJwtToken from "../security/jwtTokenValidator.js";
import { io } from "../app.js";
import validateSocket from "../security/socketValidator.js";
import { Socket } from "socket.io";
let messageIndex = 0;

type aspectEventArgs = {
    player: string;
};

io.of("/aspects").use(validateSocket);
io.of("/aspects").on("connection", (socket: Socket) => {
    socket.data.messageIndex = messageIndex;
    socket.on("give_aspect", async (args: aspectEventArgs) => {
        if (socket.data.messageIndex === messageIndex) {
            ++messageIndex;
            ++socket.data.messageIndex;
            console.log(args.player, messageIndex);
            UserModel.updateOne(
                { username: args.player },
                { $inc: { aspects: -1 } },
                {
                    upsert: true,
                    collation: { locale: "en", strength: 2 },
                }
            ).then(() => {
                console.log(args.player, "received an aspect");
            });
        } else {
            ++socket.data.messageIndex;
            if (socket.data.messageIndex < messageIndex - 10) socket.data.messageIndex = messageIndex;
        }
    });
    socket.on("sync", () => {
        socket.data.messageIndex = messageIndex;
    });
    socket.on("debug_index", () => {
        console.log(socket.data.messageIndex);
    });
});

/**
 * Maps all aspect-related endpoints.
 */
const aspectRouter = Router();

aspectRouter.get("/aspects", async (request: Request, response: Response) => {
    try {
        // Get 10 users with the highest aspect count
        const aspects = await UserModel.find({}).sort({ aspects: -1 }).limit(10);

        response.send(aspects);

        console.log("GET:", aspects);
    } catch (error) {
        response.status(500);
        response.send({ error: "Something went wrong processing the request." });
        console.error("getAspectsError:", error);
    }
});

aspectRouter.get("/aspects/:username", async (request: Request<{ username: string }>, response: Response) => {
    try {
        // Get aspect data for specified user
        const aspect = await UserModel.findOne({ username: request.params.username }).collation({
            locale: "en",
            strength: 2,
        });

        if (!aspect) {
            response.status(404).send({ error: "Specified user could not be found in aspect list." });
            return;
        }
        response.send(aspect);
        console.log("GET specific:", aspect);
    } catch (error) {
        response.status(500);
        response.send({ error: "Something went wrong processing the request." });
        console.error("getSpecificAspectsError:", error);
    }
});

aspectRouter.post("/aspects", validateJwtToken, async (request: Request, response: Response) => {
    try {
        const updatePromises = request.body.users.map((username: string) => {
            UserModel.updateOne(
                { username: username },
                { $inc: { aspects: -1 } },
                {
                    upsert: true,
                    collation: { locale: "en", strength: 2 },
                }
            ).then(() => {
                console.log(username, "received an aspect");
            });
        });
        await Promise.all(updatePromises);
        response.send({ err: "" });
    } catch (error) {
        response.status(500);
        response.send({ error: "something went wrong" });
        console.error("giveAspectError:", error);
    }
});

export default aspectRouter;
