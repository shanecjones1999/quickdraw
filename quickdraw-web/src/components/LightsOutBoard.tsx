import styles from "../styles/LightsOutBoard.module.css";

interface Props {
    board: boolean[][];
    onCellPress?: (row: number, col: number) => void;
    readonly?: boolean;
    solved?: boolean;
    mini?: boolean;
}

export function LightsOutBoard({
    board,
    onCellPress,
    readonly = false,
    solved = false,
    mini = false,
}: Props) {
    return (
        <div
            className={`${styles.board} ${mini ? styles.boardMini : ""} ${solved ? styles.boardSolved : ""}`.trim()}
        >
            {board.map((row, rowIndex) =>
                row.map((isLit, colIndex) => {
                    const disabled = readonly || !onCellPress;
                    return (
                        <button
                            key={`${rowIndex}-${colIndex}`}
                            type="button"
                            className={`${styles.cell} ${isLit ? styles.cellLit : styles.cellDark} ${mini ? styles.cellMini : ""}`.trim()}
                            onClick={() => onCellPress?.(rowIndex, colIndex)}
                            disabled={disabled}
                            aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, ${isLit ? "light on" : "light off"}`}
                        />
                    );
                }),
            )}
        </div>
    );
}
