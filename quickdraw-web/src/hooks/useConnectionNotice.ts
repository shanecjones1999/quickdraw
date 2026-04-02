import { useCallback, useEffect, useRef, useState } from "react";
import {
    getConnectErrorNotice,
    getDisconnectNotice,
    getReconnectAttemptNotice,
    getReconnectSuccessNotice,
    getServerErrorNotice,
    type ConnectionNoticeData,
} from "../connectionMessages";
import { socket } from "../socket";

interface PlayerOptions {
    role: "player";
    roomCode: string;
    playerName: string;
    playerSessionId: string;
}

interface HostOptions {
    role: "host";
}

type Options = PlayerOptions | HostOptions;

export function useConnectionNotice(options: Options) {
    const [notice, setNotice] = useState<ConnectionNoticeData | null>(null);
    const hadDisconnectRef = useRef(false);
    const pendingRejoinRef = useRef(false);
    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    const clearSuccessTimeout = useCallback(() => {
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
        }
    }, []);

    const dismissNotice = useCallback(() => {
        clearSuccessTimeout();
        setNotice(null);
    }, [clearSuccessTimeout]);

    const setTimedNotice = useCallback(
        (nextNotice: ConnectionNoticeData, autoHideMs?: number) => {
            clearSuccessTimeout();
            setNotice(nextNotice);

            if (autoHideMs) {
                successTimeoutRef.current = setTimeout(() => {
                    setNotice(null);
                    successTimeoutRef.current = null;
                }, autoHideMs);
            }
        },
        [clearSuccessTimeout],
    );

    const retryConnection = useCallback(() => {
        if (options.role === "host" && hadDisconnectRef.current) {
            window.location.reload();
            return;
        }

        socket.connect();
    }, [options.role]);

    useEffect(() => {
        function onDisconnect() {
            hadDisconnectRef.current = true;
            pendingRejoinRef.current = false;
            setTimedNotice(
                getDisconnectNotice(
                    options.role,
                    options.role === "player" ? options.roomCode : undefined,
                ),
            );
        }

        function onConnectError() {
            setTimedNotice(getConnectErrorNotice(options.role));
        }

        function onConnect() {
            if (!hadDisconnectRef.current) return;

            if (options.role === "player") {
                pendingRejoinRef.current = true;
                setTimedNotice(getReconnectAttemptNotice(options.roomCode));
                socket.emit("player:join", {
                    roomCode: options.roomCode,
                    playerName: options.playerName,
                    playerSessionId: options.playerSessionId,
                });
                return;
            }

            setTimedNotice(getDisconnectNotice("host"));
        }

        function onRoomUpdated() {
            if (!pendingRejoinRef.current || options.role !== "player") return;

            pendingRejoinRef.current = false;
            hadDisconnectRef.current = false;
            setTimedNotice(getReconnectSuccessNotice(options.roomCode), 3500);
        }

        function onError(payload: { message?: string }) {
            if (!payload.message) return;

            if (pendingRejoinRef.current) {
                pendingRejoinRef.current = false;
            }

            setTimedNotice(getServerErrorNotice(payload.message, options.role));
        }

        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);
        socket.on("connect", onConnect);
        socket.on("room:updated", onRoomUpdated);
        socket.on("error", onError);

        return () => {
            clearSuccessTimeout();
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);
            socket.off("connect", onConnect);
            socket.off("room:updated", onRoomUpdated);
            socket.off("error", onError);
        };
    }, [clearSuccessTimeout, options, setTimedNotice]);

    return {
        notice,
        dismissNotice,
        retryConnection,
    };
}
