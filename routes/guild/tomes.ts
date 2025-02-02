﻿import validateJwtToken from "../../middleware/jwtTokenValidator.middleware.js";
import { Router } from "express";
import verifyInGuild from "../../middleware/verifyInGuild.middleware.js";
import { guildDatabases } from "../../models/guildDatabaseModel.js";
import { GuildRequest } from "../../communication/requests/guildRequest.js";
import verifyGuild from "../../middleware/verifyGuild.middleware.js";
import { DefaultResponse } from "../../communication/responses/defaultResponse.js";
import { ITome } from "../../models/schemas/tomeSchema.js";

/**
 * Maps all tome-related endpoints
 */
const tomeRouter = Router();

tomeRouter.get("/:wynnGuildId", verifyGuild, async (request: GuildRequest, response: DefaultResponse<ITome[]>) => {
    try {
        // Get users ordered by time added
        const tomeList = await guildDatabases[request.params.wynnGuildId].TomeModel.find({}).sort({ dateAdded: 1 });

        // Return 'OK' if nothing goes wrong
        response.status(200).send(tomeList);
    } catch (error) {
        response.status(500);
        response.send({ error: "Something went wrong processing the request." });
        console.error("getTomesError:", error);
    }
});

tomeRouter.post(
    "/:wynnGuildId",
    verifyGuild,
    validateJwtToken,
    verifyInGuild,
    async (request: GuildRequest<{}, {}, { username: string }>, response: DefaultResponse<ITome>) => {
        try {
            // Save tome model on database
            const tomeData = request.body;

            const exists = await guildDatabases[request.params.wynnGuildId].TomeModel.findOne({
                username: tomeData.username,
            }).collation({
                locale: "en",
                strength: 2,
            });

            // If user exists, return 'Bad Request'
            if (exists) {
                response.status(400).send({ error: "User already in tome list." });
                return;
            }

            // Create and save user in the database
            const tome = new guildDatabases[request.params.wynnGuildId].TomeModel(tomeData);
            await tome.save();

            // Send 'Created' if saved successfully
            response.status(201).send(tome);
            console.log(tome, "added to tome list");
        } catch (error) {
            response.status(500).send({
                error: "Something went wrong processing your request.",
            });
            console.error("postTomeError:", error);
        }
    }
);

tomeRouter.get(
    "/:wynnGuildId/:username",
    verifyGuild,
    async (
        request: GuildRequest<{ username: string }>,
        response: DefaultResponse<{ username: string; position: number }>
    ) => {
        try {
            // Search for specific user
            const result = await guildDatabases[request.params.wynnGuildId].TomeModel.findOne({
                username: request.params.username,
            }).collation({
                strength: 2,
                locale: "en",
            });

            if (!result) {
                response.status(404).send({
                    error: "Specified user could not be found in tome list.",
                });
                return;
            }

            const position =
                (await guildDatabases[request.params.wynnGuildId].TomeModel.find({
                    dateAdded: { $lt: result.dateAdded.getTime() },
                }).countDocuments()) + 1;

            // Return 'OK' if nothing goes wrong
            response.status(200).send({ username: result.username, position: position });
            console.log("GET:", result.username, "at position", position);
        } catch (error) {
            response.status(500);
            response.send({ error: "Something went wrong processing the request." });
            console.error("getTomesSpecificError:", error);
        }
    }
);

tomeRouter.delete(
    "/:wynnGuildId/:username",
    verifyGuild,
    validateJwtToken,
    async (request: GuildRequest<{ username: string }>, response: DefaultResponse) => {
        try {
            // Get username from route
            const username = request.params.username;

            // Find entity by name and delete
            const result = await guildDatabases[request.params.wynnGuildId].TomeModel.findOneAndDelete({
                username: username,
            }).collation({
                locale: "en",
                strength: 2,
            });

            // If no entity was found, return 'Not Found'
            if (!result) {
                response.status(404).send({ error: "User could not be found in tome list." });
                return;
            }

            // Else return 'No Content'
            response.status(204).send();
        } catch (error) {
            response.status(500).send({
                error: "Something went wrong processing your request.",
            });
            console.error("deleteTomeError:", error);
        }
    }
);

export default tomeRouter;
