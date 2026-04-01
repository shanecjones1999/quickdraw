import { PipeConnectBoard } from "./PipeConnectBoard";
import type { PipeConnectProgressSnapshot } from "../types";
import styles from "../styles/PipeConnectPlayerCard.module.css";

interface Props {
    name: string;
    snapshot: PipeConnectProgressSnapshot | null;
}

export function PipeConnectPlayerCard({ name, snapshot }: Props) {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.name}>{name}</span>
                {snapshot?.solved ? (
                    <span className={styles.done}>✓ Solved</span>
                ) : null}
            </div>

            {snapshot ? (
                <>
                    <PipeConnectBoard
                        tiles={snapshot.tiles}
                        readonly
                        mini
                        solved={snapshot.solved}
                    />
                    <div className={styles.stats}>
                        <span>{snapshot.moves} turns</span>
                        {snapshot.rank !== null ? (
                            <span>#{snapshot.rank}</span>
                        ) : null}
                    </div>
                </>
            ) : (
                <div className={styles.waiting}>Waiting…</div>
            )}
        </div>
    );
}
