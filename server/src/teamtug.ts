export const TEAM_TUG_ROUND_DURATION_MS = 15000;
export const TEAM_TUG_FINISH_LINE = 40;

export type TeamTugTeamId = "red" | "blue";

export interface TeamTugPlayerAssignment {
    sessionId: string;
}

export interface TeamTugTeamState {
    id: TeamTugTeamId;
    name: string;
    direction: -1 | 1;
    totalPulls: number;
    members: TeamTugPlayerAssignment[];
    contributions: Record<string, number>;
}

export interface TeamTugState {
    finishLine: number;
    markerPosition: number;
    timeLimitMs: number;
    startedAt: number;
    winnerTeamId: TeamTugTeamId | null;
    teams: Record<TeamTugTeamId, TeamTugTeamState>;
}

interface PlayerSeed {
    sessionId: string;
}

export function createTeamTugState(players: PlayerSeed[]): TeamTugState {
    const shuffledPlayers = [...players];

    for (let index = shuffledPlayers.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffledPlayers[index], shuffledPlayers[swapIndex]] = [
            shuffledPlayers[swapIndex],
            shuffledPlayers[index],
        ];
    }

    const teams: Record<TeamTugTeamId, TeamTugTeamState> = {
        red: {
            id: "red",
            name: "Scarlet",
            direction: -1,
            totalPulls: 0,
            members: [],
            contributions: {},
        },
        blue: {
            id: "blue",
            name: "Cobalt",
            direction: 1,
            totalPulls: 0,
            members: [],
            contributions: {},
        },
    };

    shuffledPlayers.forEach((player, index) => {
        const teamId: TeamTugTeamId = index % 2 === 0 ? "red" : "blue";
        teams[teamId].members.push({ sessionId: player.sessionId });
        teams[teamId].contributions[player.sessionId] = 0;
    });

    return {
        finishLine: TEAM_TUG_FINISH_LINE,
        markerPosition: 0,
        timeLimitMs: TEAM_TUG_ROUND_DURATION_MS,
        startedAt: Date.now(),
        winnerTeamId: null,
        teams,
    };
}

export function getTeamTugPlayerTeamId(
    state: TeamTugState,
    playerSessionId: string,
): TeamTugTeamId | null {
    if (state.teams.red.members.some((member) => member.sessionId === playerSessionId)) {
        return "red";
    }

    if (
        state.teams.blue.members.some(
            (member) => member.sessionId === playerSessionId,
        )
    ) {
        return "blue";
    }

    return null;
}

export function applyTeamTugPull(
    state: TeamTugState,
    playerSessionId: string,
): { ok: boolean; state: TeamTugState; winnerTeamId: TeamTugTeamId | null } {
    const teamId = getTeamTugPlayerTeamId(state, playerSessionId);
    if (!teamId || state.winnerTeamId) {
        return { ok: false, state, winnerTeamId: state.winnerTeamId };
    }

    const team = state.teams[teamId];
    const nextTeam: TeamTugTeamState = {
        ...team,
        totalPulls: team.totalPulls + 1,
        contributions: {
            ...team.contributions,
            [playerSessionId]: (team.contributions[playerSessionId] ?? 0) + 1,
        },
    };

    const markerPosition = state.markerPosition + team.direction;
    const winnerTeamId =
        Math.abs(markerPosition) >= state.finishLine ? teamId : null;

    return {
        ok: true,
        winnerTeamId,
        state: {
            ...state,
            markerPosition,
            winnerTeamId,
            teams: {
                ...state.teams,
                [teamId]: nextTeam,
            },
        },
    };
}

export function getLeadingTeamTugTeamId(
    state: TeamTugState,
): TeamTugTeamId | null {
    if (state.markerPosition < 0) return "red";
    if (state.markerPosition > 0) return "blue";

    if (state.teams.red.totalPulls > state.teams.blue.totalPulls) return "red";
    if (state.teams.blue.totalPulls > state.teams.red.totalPulls) return "blue";

    return null;
}
