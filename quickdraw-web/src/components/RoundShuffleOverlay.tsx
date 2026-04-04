import { useEffect, useMemo, useRef, useState } from "react";
import type { GameType } from "../types";
import { formatGameLabel, getGameInstructionMeta } from "../gameMeta";
import styles from "../styles/RoundShuffleOverlay.module.css";

interface Props {
    gameType: GameType;
    availableGameTypes: GameType[];
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
    recentWinnerName?: string | null;
    leaderName?: string | null;
    onReady?: () => void;
}

const REEL_SLOWDOWN_FACTOR = 1.5;
const INITIAL_REEL_DELAY_MS = 270;

function rotateGameTypes(gameTypes: GameType[], offset: number): GameType[] {
    return [
        ...gameTypes.slice(offset),
        ...gameTypes.slice(0, offset),
    ];
}

function buildShuffleSequence(
    targetGameType: GameType,
    availableGameTypes: GameType[],
): GameType[] {
    const gameTypes = availableGameTypes.includes(targetGameType)
        ? availableGameTypes
        : [...availableGameTypes, targetGameType];
    const startOffset = Math.floor(Math.random() * gameTypes.length);
    const firstPass = rotateGameTypes(gameTypes, startOffset);
    const secondPass = rotateGameTypes(
        gameTypes,
        (startOffset + 3) % gameTypes.length,
    );
    const landingPass = rotateGameTypes(
        gameTypes,
        (startOffset + 1) % gameTypes.length,
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
    availableGameTypes,
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
    recentWinnerName = null,
    leaderName = null,
    onReady,
}: Props) {
    const sequence = useMemo(
        () => buildShuffleSequence(gameType, availableGameTypes),
        [availableGameTypes, gameType],
    );
    const [activeIndex, setActiveIndex] = useState(0);
    const [showInstructions, setShowInstructions] = useState(false);
    const [countdownNow, setCountdownNow] = useState(() => Date.now());
    const phaseStartedAtRef = useRef(Date.now());
    const readyThresholdReachedAtRef = useRef<number | null>(null);
    const instructionMeta = getGameInstructionMeta(gameType);

    const revealMsRemaining = Math.max(
        0,
        durationMs - (countdownNow - phaseStartedAtRef.current),
    );
    const revealCountdown = Math.max(
        1,
        Math.min(3, Math.ceil(revealMsRemaining / 1000)),
    );
    const landingMsRemaining = readyThresholdReachedAtRef.current
        ? Math.max(
              0,
              landingBufferMs -
                  (countdownNow - readyThresholdReachedAtRef.current),
          )
        : landingBufferMs;
    const landingCountdown = Math.max(0, Math.ceil(landingMsRemaining / 1000));
    const countdownLabel = !showInstructions
        ? "Locks in"
        : readyThresholdMet
          ? landingCountdown > 0
              ? "Starting in"
              : "Starting now"
          : canReady
            ? "Tap ready"
            : "Stand by";
    const countdownValue = !showInstructions
        ? String(revealCountdown)
        : readyThresholdMet
          ? String(Math.max(landingCountdown, 0))
          : "•";
    const leaderBadgeLabel =
        leaderName && leaderName !== recentWinnerName ? leaderName : null;

    const previousLabel = formatGameLabel(
        sequence[Math.max(activeIndex - 1, 0)] ?? gameType,
    );
    const currentLabel = formatGameLabel(sequence[activeIndex] ?? gameType);
    const nextLabel = formatGameLabel(
        sequence[Math.min(activeIndex + 1, sequence.length - 1)] ?? gameType,
    );

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCountdownNow(Date.now());
        }, 100);

        return () => {
            clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        if (readyThresholdMet) {
            readyThresholdReachedAtRef.current ??= Date.now();
            return;
        }

        readyThresholdReachedAtRef.current = null;
    }, [readyThresholdMet]);

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
            <div
                className={`${styles.card} ${showInstructions ? styles.cardReveal : styles.cardShuffle}`}
            >
                <div className={styles.kicker}>
                    Round {roundNumber}/{totalRounds}
                </div>
                {recentWinnerName || leaderBadgeLabel ? (
                    <div className={styles.metaRow}>
                        {recentWinnerName ? (
                            <div className={styles.metaBadge}>
                                Last win: {recentWinnerName}
                            </div>
                        ) : null}
                        {leaderBadgeLabel ? (
                            <div className={styles.metaBadge}>
                                Leader: {leaderBadgeLabel}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                <div className={styles.title}>{phaseTitle}</div>
                <div className={styles.subtitle}>{phaseSubtitle}</div>
                <div
                    className={`${styles.countdownBadge} ${showInstructions ? styles.countdownBadgeLocked : ""} ${!showInstructions || readyThresholdMet ? styles.countdownBadgePulse : ""}`}
                >
                    <span className={styles.countdownLabel}>
                        {countdownLabel}
                    </span>
                    <span
                        key={`${showInstructions ? "reveal" : "shuffle"}-${countdownValue}`}
                        className={styles.countdownValue}
                    >
                        {countdownValue}
                    </span>
                </div>
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
                            Shuffling every challenge and narrowing it down…
                        </div>
                    </>
                ) : (
                    <div className={styles.revealBlock}>
                        <div className={styles.revealBadge}>
                            {formatGameLabel(gameType)}
                        </div>
                        <div className={styles.revealCaption}>
                            Locked in for Round {roundNumber}
                        </div>
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
