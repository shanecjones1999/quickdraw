import type { GameHandler, SocketType } from "../gameHandler.js";
import type { TeamTugState, TeamTugTeamId } from "../teamtug.js";
import {
    TEAM_TUG_FINISH_LINE,
    TEAM_TUG_ROUND_DURATION_MS,
    applyTeamTugPull,
    createTeamTugState,
    getLeadingTeamTugTeamId,
} from "../teamtug.js";
import type { Server } from "socket.io";
import type { Player, Room } from "../types.js";
import { getRoom } from "../rooms.js";

function serializeState(room: Room) {
    if (!room.teamTugState) return null;

    return {
        finishLine: room.teamTugState.finishLine,
        markerPosition: room.teamTugState.markerPosition,
        timeLimitMs: room.teamTugState.timeLimitMs,
        startedAt: room.teamTugState.startedAt,
        winnerTeamId: room.teamTugState.winnerTeamId,
        teams: (["red", "blue"] as const).map((teamId) => {
            const team = room.teamTugState!.teams[teamId];

            return {
                id: team.id,
                name: team.name,
                totalPulls: team.totalPulls,
                members: team.members.map((member) => {
                    const player = room.players.get(member.sessionId);

                    return {
                        id: player?.id ?? member.sessionId,
                        sessionId: member.sessionId,
                        name: player?.name ?? "Disconnected Player",
                        connected: player?.connected ?? false,
                        contribution: team.contributions[member.sessionId] ?? 0,
                    };
                }),
            };
        }),
    };
}

export const teamtugHandler: GameHandler = {
    type: "teamtug",
    minPlayers: 2,

    createSeed(players) {
        return createTeamTugState(
            (players ?? []).map((p) => ({ sessionId: p.sessionId })),
        );
    },
    createState() {
        return {};
    },
    startPayload() {
        return {};
    },

    customStart: true,
    onStart(io: Server, room: Room, seed: unknown, endGame: (roomCode: string) => void) {
        room.teamTugState = seed as TeamTugState;

        room.roundEndAt = Date.now() + room.teamTugState.timeLimitMs;
        room.roundEndTimeout = setTimeout(() => {
            room.roundEndTimeout = null;

            if (getRoom(room.code) !== room) return;
            if (room.phase !== "playing" || room.gameType !== "teamtug") return;
            if (room.teamTugState) {
                room.teamTugState.winnerTeamId = getLeadingTeamTugTeamId(
                    room.teamTugState,
                );
            }
            endGame(room.code);
        }, room.teamTugState.timeLimitMs);

        io.to(room.code).emit("game:started", {
            gameType: "teamtug",
            teamTugState: serializeState(room),
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
        });
    },

    onCleanup(room: Room) {
        if (room.roundEndTimeout) {
            clearTimeout(room.roundEndTimeout);
            room.roundEndTimeout = null;
        }
        room.roundEndAt = null;
        room.teamTugState = null;
    },

    customAction: true,
    onAction(
        io: Server,
        room: Room,
        socket: SocketType,
        _data: unknown,
        endGame: (roomCode: string) => void,
    ) {
        const player = [...room.players.values()].find(
            (p) => p.id === socket.id,
        );
        if (!player || !room.teamTugState) return;
        if (room.roundEndAt !== null && Date.now() > room.roundEndAt) return;

        const { ok, state, winnerTeamId } = applyTeamTugPull(
            room.teamTugState,
            player.sessionId,
        );
        if (!ok) return;

        room.teamTugState = state;

        const snapshot = serializeState(room);
        if (!snapshot) return;

        io.to(room.code).emit("teamtug:update", snapshot);

        if (winnerTeamId) {
            if (room.roundEndTimeout) {
                clearTimeout(room.roundEndTimeout);
                room.roundEndTimeout = null;
            }
            room.roundEndAt = null;
            room.teamTugState.winnerTeamId = winnerTeamId;
            endGame(room.code);
        }
    },

    actionEvent: "teamtug:pull",
    applyAction(state, _data) {
        return { ok: false, state };
    },
    isPlayerDone() {
        return false;
    },
    shouldTrackFinish() {
        return false;
    },

    updateEvent: "teamtug:update",
    updatePayload() {
        return {};
    },

    solvedEvent: null,
    solvedPayload() {
        return {};
    },

    progressEvent: "teamtug:progress",
    progressPayload() {
        return {};
    },

    resumeStartPayload(_state, room?: Room) {
        return {};
    },
    resumeSyncEvent: "teamtug:update",
    resumeSyncPayload() {
        return {};
    },
    shouldResumeSolved() {
        return false;
    },
    resumeSolvedPayload() {
        return {};
    },

    buildResults(players, room?: Room) {
        if (!room?.teamTugState) return [];

        const uniqueWinnerTeamId =
            room.teamTugState.winnerTeamId ??
            getLeadingTeamTugTeamId(room.teamTugState);

        return (["red", "blue"] as const)
            .map((teamId) => {
                const team = room.teamTugState!.teams[teamId];
                const isTie = uniqueWinnerTeamId === null;

                return {
                    id: team.id,
                    name: team.name,
                    pulls: team.totalPulls,
                    winner: !isTie && uniqueWinnerTeamId === team.id,
                    rank: isTie ? 1 : uniqueWinnerTeamId === team.id ? 1 : 2,
                    members: team.members
                        .map((member) => {
                            const player = room.players.get(member.sessionId);

                            return {
                                id: player?.id ?? member.sessionId,
                                sessionId: member.sessionId,
                                name: player?.name ?? "Disconnected Player",
                                contribution:
                                    team.contributions[member.sessionId] ?? 0,
                            };
                        })
                        .sort(
                            (left, right) =>
                                right.contribution - left.contribution ||
                                left.name.localeCompare(right.name),
                        ),
                };
            })
            .sort((left, right) => {
                if (left.rank !== right.rank) return left.rank - right.rank;
                if (right.pulls !== left.pulls) return right.pulls - left.pulls;
                return left.name.localeCompare(right.name);
            });
    },
};
