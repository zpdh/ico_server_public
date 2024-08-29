import UserModel from "../models/userModel.js";
import validateJwtToken from "../security/jwtTokenValidator.js";

function mapAspectEndpoints(app) {
	app.get("/aspects", async (request, response) => {
		try {
			// Get 10 users with the highest aspect count
			const aspects = await UserModel.find({}).sort({aspects: -1}).limit(10);

			response.send(aspects);

			console.log("GET:", aspects);
		} catch (error) {
			response.status(500);
			response.send("Something went wrong processing the request.");
			console.error("getAspectsError:", error);
		}
	});

	app.post("/aspects", validateJwtToken, async (request, response) => {
		try {
			let errorMsg = "";
			request.body.users.forEach((user) => {
				UserModel.findOne({user: user.toLowerCase()}).then((res) => {
					if (res.aspects >= 1) {
						UserModel.updateOne({user: user.toLowerCase()}, {$inc: {aspects: -1}}, {upsert: true}).then(
							() => {
								console.log(user.toLowerCase(), "received an aspect");
							}
						);
					} else {
						errorMsg += res.user + ", ";
					}
				});
			});
			if (errorMsg !== "") {
				errorMsg += "were not given aspects as it would put them in debt";
			}
		} catch (error) {
			response.status(500);
			response.send({err: "something went wrong"});
			console.error("giveAspectError:", error);
		}
	});
}

export default mapAspectEndpoints;