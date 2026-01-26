import { useState, useEffect, useRef, useCallback } from 'react';
import { MeetingSocket } from '../websocket/client';
import { meetingApi } from '../api';
import { ChatMessage, WSMessage, Participant } from '../types';
import { toast } from 'sonner';

interface UseMeetingSocketProps {
    roomId: string; // This might be used as roomId or sessionId
    userName: string;
}

export function useMeetingSocket({ roomId, userName }: UseMeetingSocketProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<MeetingSocket | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Initialize WebSocket
    useEffect(() => {
        if (!roomId) return;

        console.log('🚀 Connecting to room socket:', roomId);
        const socket = new MeetingSocket(roomId);
        socketRef.current = socket;
        socket.connect();

        const cleanup = socket.onMessage((msg: WSMessage) => {
            if (msg.type === 'session_connected') {
                setIsConnected(true);
                setSessionId(roomId);
                toast.success('チャットサーバーに接続しました');
            } else if (msg.type === 'members_updated') {
                // Real-time sync of room members
                if (msg.data && Array.isArray(msg.data.members)) {
                    const newParticipants = msg.data.members.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        isOnline: m.status === 'online',
                        avatar: m.avatar
                    }));
                    setParticipants(newParticipants);
                }
            } else if (msg.type === 'chat') {
                const data = msg.data;
                const chatMsg: ChatMessage = {
                    id: data.id,
                    room_id: data.room_id,
                    seq: data.seq,
                    sender_member_id: data.sender_member_id,
                    display_name: data.display_name,
                    text: data.text,
                    lang: data.lang,
                    created_at: data.created_at,
                    isMe: data.display_name === userName
                };
                setMessages(prev => [...prev, chatMsg]);
            } else if (msg.type === 'translation') {
                const data = msg.data;
                setMessages(prev => {
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

        return () => {
            cleanup();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [roomId, userName]);

    const sendMessage = useCallback((text: string) => {
        if (socketRef.current) {
            socketRef.current.sendChat(text, 'auto');
        }
    }, []);

    return {
        messages,
        participants,
        setParticipants,
        isConnected,
        sendMessage,
        sessionId
    };
}
