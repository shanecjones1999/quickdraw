import { useEffect, useMemo, useState } from "react";
import type { GameType } from "../types";
import {
    ALL_GAME_TYPES,
    formatGameLabel,
    getGameInstructionMeta,
} from "../gameMeta";
import styles from "../styles/RoundShuffleOverlay.module.css";

interface Props {
    gameType: GameType;
    roundNumber: number;
    totalRounds: number;
    durationMs: number;
    landingBufferMs: number;
    title: string;
    subtitle: string;
    readyCount?: number;
    readyTarget?: number;
    readyThresholdMet?: boolean;
    canReady?: boolean;
    playerReady?: boolean;
    onReady?: () => void;
}

const REEL_SLOWDOWN_FACTOR = 1.5;
const INITIAL_REEL_DELAY_MS = 270;
const MYSTERY_LABELS = ["🎲 Mystery Game", "⚡ Random Draw", "❓ Hidden Pick"];

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
    readyCount = 0,
    readyTarget = 1,
    readyThresholdMet = false,
    canReady = false,
    playerReady = false,
    onReady,
}: Props) {
    const sequence = useMemo(() => buildShuffleSequence(gameType), [gameType]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showInstructions, setShowInstructions] = useState(false);
    const instructionMeta = getGameInstructionMeta(gameType);

    const previousLabel =
        MYSTERY_LABELS[
            (Math.max(activeIndex - 1, 0) + MYSTERY_LABELS.length) %
                MYSTERY_LABELS.length
        ];
    const currentLabel = MYSTERY_LABELS[activeIndex % MYSTERY_LABELS.length];
    const nextLabel = MYSTERY_LABELS[(activeIndex + 1) % MYSTERY_LABELS.length];

    useEffect(() => {
        let cancelled = false;
        const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
        const steps = Math.max(sequence.length - 1, 1);

        timeoutIds.push(
            setTimeout(() => {
                if (!cancelled) {
                    setShowInstructions(true);
                }
            }, durationMs),
        );

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

    const phaseTitle = showInstructions
        ? `Next up: ${instructionMeta.shortLabel}`
        : title;
    const phaseSubtitle = showInstructions
        ? "Quick rules check before the round begins."
        : subtitle;
    const waitingForReady = showInstructions && !readyThresholdMet;

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.kicker}>
                    Round {roundNumber}/{totalRounds}
                </div>
                <div className={styles.title}>{phaseTitle}</div>
                <div className={styles.subtitle}>{phaseSubtitle}</div>
                {!showInstructions ? (
                    <>
                        <div className={styles.reelFrame}>
                            <div
                                key={`${gameType}-${activeIndex}`}
                                className={styles.reelWindow}
                            >
                                <div className={styles.reelItem}>
                                    {previousLabel}
                                </div>
                                <div
                                    className={`${styles.reelItem} ${styles.reelItemActive}`}
                                >
                                    {currentLabel}
                                </div>
                                <div className={styles.reelItem}>
                                    {nextLabel}
                                </div>
                            </div>
                        </div>
                        <div className={styles.finalLabel}>
                            Drawing this round’s mini-game…
                        </div>
                    </>
                ) : (
                    <div className={styles.revealBadge}>
                        {formatGameLabel(gameType)}
                    </div>
                )}
                <div
                    className={`${styles.instructionsCard} ${showInstructions ? styles.instructionsCardVisible : styles.instructionsCardHidden}`}
                >
                    <div className={styles.instructionsHeader}>
                        <div className={styles.instructionsTitle}>
                            {instructionMeta.shortLabel}
                        </div>
                        <div className={styles.instructionsCategory}>
                            {instructionMeta.category}
                        </div>
                    </div>
                    <div className={styles.instructionsGrid}>
                        <div className={styles.instructionsItem}>
                            <span className={styles.instructionsLabel}>
                                Objective
                            </span>
                            <span className={styles.instructionsText}>
                                {instructionMeta.objective}
                            </span>
                        </div>
                        <div className={styles.instructionsItem}>
                            <span className={styles.instructionsLabel}>
                                Controls
                            </span>
                            <span className={styles.instructionsText}>
                                {instructionMeta.controls}
                            </span>
                        </div>
                        <div
                            className={`${styles.instructionsItem} ${styles.instructionsItemWide}`}
                        >
                            <span className={styles.instructionsLabel}>
                                Win Condition
                            </span>
                            <span className={styles.instructionsText}>
                                {instructionMeta.winCondition}
                            </span>
                        </div>
                    </div>
                    {showInstructions && (
                        <div className={styles.instructionsFooterBlock}>
                            <div className={styles.instructionsFooter}>
                                {readyThresholdMet
                                    ? "Ready received — starting the round…"
                                    : `${readyCount}/${readyTarget} ready to begin`}
                            </div>
                            {waitingForReady && canReady && onReady ? (
                                <button
                                    type="button"
                                    className={styles.readyButton}
                                    onClick={onReady}
                                    disabled={playerReady}
                                >
                                    {playerReady ? "Ready Locked In" : "Ready"}
                                </button>
                            ) : null}
                            {waitingForReady && !canReady ? (
                                <div className={styles.instructionsSubtle}>
                                    Waiting for at least one player to tap
                                    Ready…
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
