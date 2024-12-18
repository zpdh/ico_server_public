import { NextFunction, Request, Response, Router } from "express";
import validateJwtToken from "../security/jwtTokenValidator.js";
import ServerConfigModel from "../models/serverConfigModel.js";

/**
 * Maps all server config related endpoints. request.guildId is NOT defined in these routes, but request.serverId is.
 */
const configRouter = Router();
const serverConfigRouter = Router({ mergeParams: true });

// Register all middlewares.
configRouter.use(validateJwtToken);
configRouter.use("/:serverId", serverConfigRouter);

serverConfigRouter.use(validateJwtToken);
serverConfigRouter.use(async (request: Request, response: Response, next: NextFunction) => {
    const query = ServerConfigModel.findOne({ serverId: request.params.serverId });
    request.serverQuery = query;
    console.log(typeof query);
    const server = await query.exec();
    if (!server) {
        response.status(404).send({ error: "Could not find specified server." });
        return;
    }
    request.serverConfig = server;
    next();
});

configRouter.post("/", async (request: Request<{}, {}, { serverId: number; guildId: string }>, response: Response) => {
    try {
        const newServer = new ServerConfigModel({ serverId: request.body.serverId, guildId: request.body.guildId });
        await newServer.save();
        response.send(newServer);
    } catch (error) {
        console.error("post config error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

serverConfigRouter.get("/", async (request: Request, response: Response) => {
    try {
        response.send(request.serverConfig);
    } catch (error) {
        console.error("get server config error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

serverConfigRouter.delete("/", async (request: Request, response: Response) => {
    try {
        request.serverQuery!.deleteOne().exec();
        response.status(204).send();
    } catch (error) {
        console.error("delete server config error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

serverConfigRouter.patch(
    "/",
    async (
        request: Request<
            {},
            {},
            {
                tomeChannel?: number;
                layoffsChannel?: number;
                raidsChannel?: number;
                warQuestionsChannel?: number;
                warChannel?: number;
            }
        >,
        response: Response
    ) => {
        try {
            const body = request.body;
            if (body.tomeChannel) request.serverConfig!.tomeChannel = body.tomeChannel;
            if (body.layoffsChannel) request.serverConfig!.layoffsChannel = body.layoffsChannel;
            if (body.raidsChannel) request.serverConfig!.raidsChannel = body.raidsChannel;
            if (body.warQuestionsChannel) request.serverConfig!.warQuestionsChannel = body.warQuestionsChannel;
            if (body.warChannel) request.serverConfig!.warChannel = body.warChannel;
            await request.serverConfig!.save();
            response.status(204).send();
        } catch (error) {
            console.error("patch server config error:", error);
            response.status(500).send({ error: "Something went wrong processing the request." });
        }
    }
);

serverConfigRouter.post(
    "/privileged-role",
    async (request: Request<{}, {}, { newRoleId: number }>, response: Response) => {
        try {
            request.serverConfig!.privilegedRoles.push(request.body.newRoleId);
            await request.serverConfig!.save();
            response.status(204).send();
        } catch (error) {
            console.error("privileged role post error:", error);
            response.status(500).send({ error: "Something went wrong processing the request." });
        }
    }
);

serverConfigRouter.delete(
    "/privileged-role",
    async (request: Request<{}, {}, { roleId: number }>, response: Response) => {
        try {
            const index = request.serverConfig!.privilegedRoles.indexOf(request.body.roleId);
            if (index === -1) {
                response.status(404).send({ error: "Role was not privileged." });
                return;
            }
            request.serverConfig!.privilegedRoles.splice(index, 1);
            await request.serverConfig?.save();
            response.status(204).send();
        } catch (error) {
            console.error("privileged role delete error:", error);
            response.status(500).send({ error: "Something went wrong processing the request." });
        }
    }
);

serverConfigRouter.post("/invite", async (request: Request<{}, {}, { guildId: string }>, response: Response) => {
    try {
        const invited = await ServerConfigModel.findOne({ guildId: request.body.guildId }).exec();
        if (!invited) {
            response.status(404).send({ error: "Could not find specified guild server." });
            return;
        }
        request.serverConfig!.outgoingInvites.push(request.body.guildId);
        await request.serverConfig!.save();

        invited.invites.push(request.serverConfig!.guildId);
        await invited.save();

        response.status(204).send();
    } catch (error) {
        console.error("post invite error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

serverConfigRouter.delete("/invite", async (request: Request<{}, {}, { guildId: string }>, response: Response) => {
    try {
        const invited = await ServerConfigModel.findOne({ guildId: request.body.guildId }).exec();
        const myGuildId = request.serverConfig!.guildId;
        if (!invited) {
            response.status(404).send({ error: "Could not find specified guild server." });
            return;
        }
        const myIndex = request.serverConfig!.outgoingInvites.indexOf(request.body.guildId);
        const invitedIndex = invited.invites.indexOf(myGuildId);
        if (myIndex === -1) {
            response.status(404).send({ error: "Specified guild server was not invited." });
        }
        if (invitedIndex === -1) {
            console.warn("two way invite broken for guild ids:", myGuildId, invited.guildId);
        } else {
            invited.invites.splice(invitedIndex, 1);
        }
        request.serverConfig!.outgoingInvites.splice(myIndex, 1);

        await request.serverConfig!.save();
        await invited.save();

        response.status(204).send();
    } catch (error) {
        console.error("delete invite error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

// bot should do validation for channel id
serverConfigRouter.post(
    "/invite/accept",
    async (request: Request<{}, {}, { guildId: string; channelId: number }>, response: Response) => {
        try {
            const guildId = request.body.guildId;
            const channelId = request.body.channelId;
            const inviter = await ServerConfigModel.findOne({ guildId: guildId }).exec();
            if (!inviter) {
                response.status(404).send({ error: "Could not find specified guild." });
                return;
            }
            const index = request.serverConfig!.invites.indexOf(guildId);
            const inviterIndex = inviter.outgoingInvites.indexOf(request.serverConfig!.guildId);
            if (index === -1 || inviterIndex === -1) {
                response.status(404).send({ error: "Could not find invite." });
                return;
            }
            inviter.outgoingInvites.splice(inviterIndex, 1);
            inviter.broadcastChannelIds.push(channelId);
            await inviter.save();

            request.serverConfig!.invites.splice(index, 1);
            request.serverConfig!.listeningChannelIds.push({ guildId: guildId, channelId: channelId });
            await request.serverConfig!.save();

            response.status(204).send();
        } catch (error) {
            console.error("accept invite error:", error);
            response.status(500).send({ error: "Something went wrong processing the request." });
        }
    }
);

serverConfigRouter.post("/invite/reject", async (request: Request<{}, {}, { guildId: string }>, response: Response) => {
    try {
        const guildId = request.body.guildId;
        const inviter = await ServerConfigModel.findOne({ guildId: guildId });
        if (!inviter) {
            response.status(404).send({ error: "Could not find specified guild." });
            return;
        }
        const index = request.serverConfig!.invites.indexOf(guildId);
        const inviterIndex = inviter.outgoingInvites.indexOf(request.serverConfig!.guildId);
        if (index === -1 || inviterIndex === -1) {
            response.status(404).send({ error: "Could not find invite." });
            return;
        }
        inviter.outgoingInvites.splice(inviterIndex, 1);
        await inviter.save();

        request.serverConfig!.invites.splice(index, 1);
        await request.serverConfig!.save();
        response.status(204).send();
    } catch (error) {
        console.error("reject invite error:", error);
        response.status(500).send({ error: "Something went wrong processing the request." });
    }
});

// TODO: add route for unlinking channels

export default configRouter;
