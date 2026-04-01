import type { PipeConnectTile } from "../types";
import styles from "../styles/PipeConnectBoard.module.css";

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;

interface Props {
    tiles: PipeConnectTile[];
    onRotate?: (tileId: string) => void;
    readonly?: boolean;
    solved?: boolean;
    mini?: boolean;
}

export function PipeConnectBoard({
    tiles,
    onRotate,
    readonly = false,
    solved = false,
    mini = false,
}: Props) {
    return (
        <div
            className={`${styles.board} ${mini ? styles.boardMini : ""} ${solved ? styles.boardSolved : ""}`.trim()}
        >
            {tiles.map((tile) => {
                const interactive = !readonly && !tile.locked && !!onRotate;
                return (
                    <button
                        key={tile.id}
                        type="button"
                        className={`${styles.tile} ${tile.locked ? styles.tileLocked : ""} ${mini ? styles.tileMini : ""}`.trim()}
                        onClick={() => onRotate?.(tile.id)}
                        disabled={!interactive}
                        aria-label={`Rotate tile ${tile.row + 1}, ${tile.col + 1}`}
                    >
                        <svg
                            viewBox="0 0 100 100"
                            className={styles.pipeSvg}
                            aria-hidden="true"
                        >
                            {tile.mask & NORTH ? (
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="8"
                                    className={styles.pipe}
                                />
                            ) : null}
                            {tile.mask & EAST ? (
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="92"
                                    y2="50"
                                    className={styles.pipe}
                                />
                            ) : null}
                            {tile.mask & SOUTH ? (
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="92"
                                    className={styles.pipe}
                                />
                            ) : null}
                            {tile.mask & WEST ? (
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="8"
                                    y2="50"
                                    className={styles.pipe}
                                />
                            ) : null}
                            <circle
                                cx="50"
                                cy="50"
                                r="12"
                                className={styles.pipeCenter}
                            />
                        </svg>

                        {tile.start ? (
                            <span className={`${styles.badge} ${styles.start}`}>
                                S
                            </span>
                        ) : null}
                        {tile.end ? (
                            <span className={`${styles.badge} ${styles.end}`}>
                                E
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
