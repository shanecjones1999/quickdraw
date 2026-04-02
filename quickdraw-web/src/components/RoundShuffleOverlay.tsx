import { useEffect, useMemo, useState } from "react";
import type { GameType } from "../types";
import { ALL_GAME_TYPES, formatGameLabel } from "../gameMeta";
import styles from "../styles/RoundShuffleOverlay.module.css";

interface Props {
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
    title: string;
    subtitle: string;
}

const REEL_SLOWDOWN_FACTOR = 1.5;
const INITIAL_REEL_DELAY_MS = 270;

function rotateGameTypes(offset: number): GameType[] {
    return [
        ...ALL_GAME_TYPES.slice(offset),
        ...ALL_GAME_TYPES.slice(0, offset),
    ];
}

function buildShuffleSequence(targetGameType: GameType): GameType[] {
    const startOffset = Math.floor(Math.random() * ALL_GAME_TYPES.length);
    const firstPass = rotateGameTypes(startOffset);
    const secondPass = rotateGameTypes(
        (startOffset + 3) % ALL_GAME_TYPES.length,
    );
    const landingPass = rotateGameTypes(
        (startOffset + 1) % ALL_GAME_TYPES.length,
    );
    const sequence = [...firstPass, ...secondPass];

    for (const gameType of landingPass) {
        sequence.push(gameType);
        if (gameType === targetGameType) {
            break;
        }
    }

    if (sequence.at(-1) !== targetGameType) {
        sequence.push(targetGameType);
    }

    const targetSteps = Math.max(
        3,
        Math.round((sequence.length - 1) / REEL_SLOWDOWN_FACTOR),
    );
    const slowedSequence: GameType[] = [];

    for (let stepIndex = 0; stepIndex <= targetSteps; stepIndex += 1) {
        const sequenceIndex = Math.round(
            (stepIndex * (sequence.length - 1)) / targetSteps,
        );
        const gameType = sequence[sequenceIndex] ?? targetGameType;

        if (slowedSequence.at(-1) !== gameType) {
            slowedSequence.push(gameType);
        }
    }

    if (slowedSequence.at(-1) !== targetGameType) {
        slowedSequence.push(targetGameType);
    }

    return slowedSequence;
}

export function RoundShuffleOverlay({
    gameType,
    roundNumber,
    totalRounds,
    durationMs,
    landingBufferMs,
    title,
    subtitle,
}: Props) {
    const sequence = useMemo(() => buildShuffleSequence(gameType), [gameType]);
    const [activeIndex, setActiveIndex] = useState(0);

    const previousGameType =
        sequence[Math.max(activeIndex - 1, 0)] ?? sequence[0] ?? gameType;
    const currentGameType = sequence[activeIndex] ?? gameType;
    const nextGameType =
        sequence[Math.min(activeIndex + 1, sequence.length - 1)] ??
        sequence.at(-1) ??
        gameType;

    useEffect(() => {
        let cancelled = false;
        const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
        const steps = Math.max(sequence.length - 1, 1);

        function tick(nextIndex: number) {
            if (cancelled) return;

            setActiveIndex(nextIndex);

            if (nextIndex >= steps) {
                return;
            }

            const progress = nextIndex / steps;
            const remainingSteps = steps - nextIndex;
            const remainingDuration = Math.max(
                durationMs * (1 - progress),
                320,
            );
            const delay = Math.min(
                420,
                Math.max(125, remainingDuration / remainingSteps),
            );

            timeoutIds.push(setTimeout(() => tick(nextIndex + 1), delay));
        }

        timeoutIds.push(
            setTimeout(() => {
                if (cancelled) return;
                setActiveIndex(0);
                timeoutIds.push(
                    setTimeout(() => tick(1), INITIAL_REEL_DELAY_MS),
                );
            }, 0),
        );

        return () => {
            cancelled = true;
            for (const timeoutId of timeoutIds) {
                clearTimeout(timeoutId);
            }
        };
    }, [durationMs, landingBufferMs, sequence]);

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.kicker}>
                    Round {roundNumber}/{totalRounds}
                </div>
                <div className={styles.title}>{title}</div>
                <div className={styles.subtitle}>{subtitle}</div>
                <div className={styles.reelFrame}>
                    <div
                        key={`${gameType}-${activeIndex}`}
                        className={styles.reelWindow}
                    >
                        <div className={styles.reelItem}>
                            {formatGameLabel(previousGameType)}
                        </div>
                        <div
                            className={`${styles.reelItem} ${styles.reelItemActive}`}
                        >
                            {formatGameLabel(currentGameType)}
                        </div>
                        <div className={styles.reelItem}>
                            {formatGameLabel(nextGameType)}
                        </div>
                    </div>
                </div>
                <div className={styles.finalLabel}>
                    Landing on <span>{formatGameLabel(gameType)}</span>
                    {landingBufferMs > 0 ? "…" : ""}
                </div>
            </div>
        </div>
    );
}
