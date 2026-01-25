import { useState, useEffect, useRef, useCallback } from 'react';
import { MeetingSocket } from '../websocket/client';
import { meetingApi } from '../api';
import { ChatMessage, WSMessage } from '../types';
import { toast } from 'sonner';

interface UseMeetingSocketProps {
    roomId: string; // This might be used as roomId or sessionId
    userName: string;
}

export function useMeetingSocket({ roomId, userName }: UseMeetingSocketProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<MeetingSocket | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Initialize Session and WebSocket
    useEffect(() => {
        let mounted = true;
        let socket: MeetingSocket | null = null;

        const initSession = async () => {
            if (!roomId) return;

            try {
                // 1. Start/Get Live Session ID from Backend
                // If we treat the URL ID as room_id, we need to exchange it for a session_id
                // Or if we treat it as session_id directly, we skip this.
                // Given backend requirement: POST /meeting/{room_id}/live-sessions -> returns session

                console.log('🚀 Initializing session for room:', roomId);
                const response = await meetingApi.startLiveSession(roomId);
                const newSessionId = response.data.session.id;

                if (!mounted) return;
                setSessionId(newSessionId);

                // 2. Connect WebSocket
                socket = new MeetingSocket(newSessionId);
                socketRef.current = socket;
                socket.connect();

                // 3. Listen for messages
                socket.onMessage((msg: WSMessage) => {
                    if (msg.type === 'session_connected') {
                        setIsConnected(true);
                        toast.success('チャットサーバーに接続しました');
                    } else if (msg.type === 'chat') {
                        const data = msg.data;
                        // Convert to ChatMessage format
                        const chatMsg: ChatMessage = {
                            id: data.id,
                            room_id: data.room_id,
                            seq: data.seq,
                            sender_member_id: data.sender_member_id,
                            display_name: data.display_name,
                            text: data.text,
                            lang: data.lang,
                            created_at: data.created_at,
                            isMe: data.display_name === userName // Simple check, ideally use user ID
                        };
                        setMessages(prev => [...prev, chatMsg]);
                    } else if (msg.type === 'translation') {
                        const data = msg.data;
                        // Find original message and attach translation
                        // Current WS implementation sends translation separately.
                        // We need to match it. But how?
                        // Backend stores 'related_message_id'. We should expose it in WS payload.
                        // Backend `ws_message.py` broadcast data:
                        /*
                           "data": {
                               "room_id": room_id,
                               "participant_id": user_id,
                               "participant_name": member.display_name,
                               "Original": text,
                               "translated": translated_text,
                               "timestamp": ai_event.created_at.isoformat(),
                               "sequence": str(next_seq),
                               "lang": target_lang
                           }
                        */
                        // It doesn't send related message ID in the broadcast data unfortunately.
                        // But it sends "Original" text. We can match by text or sequence if applicable.
                        // Sequence might be distinct.
                        // Ideally we just treat it as a new "Translation Bubble" or attach to previous.
                        // For now, let's update the last matching message if possible, or append it.

                        setMessages(prev => {
                            // Try to find a message with same text sent recently?
                            // Or just add a new "System" message or modify the UI to show translation.
                            // The requirements say "Real-time translation".

                            // Let's iterate backwards to find the original message
                            const newMessages = [...prev];
                            for (let i = newMessages.length - 1; i >= 0; i--) {
                                if (newMessages[i].text === data.Original && !newMessages[i].translated) {
                                    newMessages[i] = {
                                        ...newMessages[i],
                                        translated: data.translated
                                    };
                                    return newMessages;
                                }
                            }
                            return prev;
                        });
                    }
                });

            } catch (e) {
                console.error('Failed to init session:', e);
                toast.error('サーバー接続に失敗しました');
            }
        };

        initSession();

        return () => {
            mounted = false;
            if (socket) {
                socket.disconnect();
            }
        };
    }, [roomId]);

    const sendMessage = useCallback((text: string) => {
        if (socketRef.current) {
            // Determine language (mock for now, ideally detected or user setting)
            socketRef.current.sendChat(text, 'auto');
        }
    }, []);

    return {
        messages,
        isConnected,
        sendMessage,
        sessionId
    };
}
