async function getPlayersGuildAsync(username: string) {
    const apiUrl = `https://api.wynncraft.com/v3/player/${username}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    return data.guild ?? null;
}

async function checkIfPlayerIsICoAsync(username: string) {
    const guild = await getPlayersGuildAsync(username);
    const icoId = "b250f587-ab5e-48cd-bf90-71e65d6dc9e7";

    if (guild != null) {
        if (guild.uuid == icoId) {
            return true;
        }
    }

    return false;
}

export default checkIfPlayerIsICoAsync;
