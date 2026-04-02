import type { ConnectionNoticeData } from "../connectionMessages";
import styles from "../styles/ConnectionNotice.module.css";

interface Props extends ConnectionNoticeData {
    actionLabel?: string;
    onAction?: () => void;
    onDismiss?: () => void;
    floating?: boolean;
}

export function ConnectionNotice({
    tone,
    title,
    message,
    actionLabel,
    onAction,
    onDismiss,
    floating = false,
}: Props) {
    return (
        <div
            className={`${styles.notice} ${styles[tone]} ${floating ? styles.floating : ""}`}
            role="status"
            aria-live="polite"
        >
            <div className={styles.body}>
                <div className={styles.title}>{title}</div>
                <div className={styles.message}>{message}</div>
            </div>
            {(actionLabel || onDismiss) && (
                <div className={styles.actions}>
                    {actionLabel && onAction && (
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={onAction}
                        >
                            {actionLabel}
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            type="button"
                            className={styles.dismissBtn}
                            onClick={onDismiss}
                            aria-label="Dismiss notice"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
