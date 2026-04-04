import { useCallback, useEffect, useMemo, useState } from "react";
import { socket } from "../socket";
import { useSocket } from "../hooks/useSocket";
import type { TeamTugStateSnapshot } from "../types";
import styles from "../styles/TeamTugPlayer.module.css";

interface Props {
    roomCode: string;
    playerName: string;
    playerSessionId: string;
    initialState: TeamTugStateSnapshot;
}

const TEAM_THEME = {
    red: {
        accent: "#ff6b6b",
        glow: "rgba(255, 107, 107, 0.25)",
    },
    blue: {
        accent: "#5cb8ff",
        glow: "rgba(92, 184, 255, 0.25)",
    },
} as const;

export function TeamTugPlayer({
    roomCode,
    playerName,
    playerSessionId,
    initialState,
}: Props) {
    const [tugState, setTugState] = useState(initialState);
    const [now, setNow] = useState(() => Date.now());

    const onUpdate = useCallback((nextState: TeamTugStateSnapshot) => {
        setTugState(nextState);
    }, []);

    useSocket("teamtug:update", onUpdate as never);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setNow(Date.now());
        }, 200);

        return () => clearInterval(intervalId);
    }, []);

    const playerTeam = useMemo(
        () =>
            tugState.teams.find((team) =>
                team.members.some((member) => member.sessionId === playerSessionId),
            ) ?? tugState.teams[0],
        [playerSessionId, tugState.teams],
    );
    const rivalTeam =
        tugState.teams.find((team) => team.id !== playerTeam.id) ?? playerTeam;
    const markerPercent =
        ((tugState.markerPosition + tugState.finishLine) /
            (tugState.finishLine * 2)) *
        100;
    const timeLeftMs = Math.max(
        0,
        tugState.startedAt + tugState.timeLimitMs - now,
    );
    const timeLeftSeconds = (timeLeftMs / 1000).toFixed(1);
    const myContribution =
        playerTeam.members.find((member) => member.sessionId === playerSessionId)
            ?.contribution ?? 0;
    const teamTheme = TEAM_THEME[playerTeam.id];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.logo}>⚡ Quick Draw</div>
                <div className={styles.meta}>
                    {playerName} · {roomCode}
                </div>
            </header>

            <div className={styles.content}>
                <div
                    className={styles.teamBanner}
                    style={{
                        borderColor: teamTheme.glow,
                        boxShadow: `0 18px 48px ${teamTheme.glow}`,
                    }}
                >
                    <div className={styles.teamEyebrow}>Your team</div>
                    <div
                        className={styles.teamName}
                        style={{ color: teamTheme.accent }}
                    >
                        {playerTeam.name}
                    </div>
                    <div className={styles.teamRoster}>
                        {playerTeam.members.map((member) => (
                            <span
                                key={member.sessionId}
                                className={styles.teamMate}
                            >
                                {member.name}
                                {member.sessionId === playerSessionId ? " (you)" : ""}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={styles.trackCard}>
                    <div className={styles.trackHeader}>
                        <div>
                            <div className={styles.trackTitle}>Shared tug bar</div>
                            <div className={styles.trackSubtitle}>
                                Pull to drag the marker toward {playerTeam.name}.
                            </div>
                        </div>
                        <div className={styles.timer}>{timeLeftSeconds}s</div>
                    </div>

                    <div className={styles.scoreRow}>
                        <div className={styles.scoreBlock}>
                            <span
                                className={styles.scoreTeam}
                                style={{ color: TEAM_THEME.red.accent }}
                            >
                                {tugState.teams[0]?.name}
                            </span>
                            <span className={styles.scoreValue}>
                                {tugState.teams[0]?.totalPulls ?? 0}
                            </span>
                        </div>
                        <div className={styles.scoreBlock}>
                            <span
                                className={styles.scoreTeam}
                                style={{ color: TEAM_THEME.blue.accent }}
                            >
                                {tugState.teams[1]?.name}
                            </span>
                            <span className={styles.scoreValue}>
                                {tugState.teams[1]?.totalPulls ?? 0}
                            </span>
                        </div>
                    </div>

                    <div className={styles.track}>
                        <div className={styles.finishLeft} />
                        <div className={styles.finishRight} />
                        <div className={styles.midLine} />
                        <div
                            className={styles.marker}
                            style={{ left: `${markerPercent}%` }}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    className={styles.pullButton}
                    onClick={() => socket.emit("teamtug:pull")}
                    disabled={tugState.winnerTeamId !== null}
                    style={{
                        background: `linear-gradient(135deg, ${teamTheme.accent}, #ffffff)`,
                    }}
                >
                    PULL!
                </button>

                <div className={styles.statRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Your pulls</span>
                        <span className={styles.statValue}>{myContribution}</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Opposing team</span>
                        <span className={styles.statValue}>{rivalTeam.name}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
