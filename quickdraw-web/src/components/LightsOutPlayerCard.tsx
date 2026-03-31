import { LightsOutBoard } from "./LightsOutBoard";
import type { LightsOutProgressSnapshot } from "../types";
import styles from "../styles/LightsOutPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: LightsOutProgressSnapshot | null;
}

export function LightsOutPlayerCard({ name, snapshot }: Props) {
    return (
        <div className={styles.card}>
            <div
                className={`${styles.name} ${snapshot?.solved ? styles.solved : ""}`.trim()}
            >
                {snapshot?.solved ? "💡 " : ""}
                {name}
            </div>
            {snapshot ? (
                <>
                    <LightsOutBoard
                        board={snapshot.board}
                        mini
                        readonly
                        solved={snapshot.solved}
                    />
                    <div className={styles.stats}>
                        {snapshot.solved
                            ? `✓ ${snapshot.moves} taps`
                            : `${snapshot.moves} taps`}
                        {snapshot.rank !== null ? ` · #${snapshot.rank}` : ""}
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
