import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useTranslation } from '../hooks/useTranslation';

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (roomName: string) => void;
}

export function CreateRoomModal({ isOpen, onClose, onCreate }: CreateRoomModalProps) {
    const { t } = useTranslation();
    const [roomName, setRoomName] = useState('');

    // Reset input when opening
    useEffect(() => {
        if (isOpen) {
            setRoomName('');
        }
    }, [isOpen]);

    const handleCreate = () => {
        if (!roomName.trim()) return;
        onCreate(roomName);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg">{t('createNewRoom')}</h2>
                            <p className="text-yellow-100 text-xs">Create New Space</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-full w-8 h-8 p-0"
                    >
                        ✕
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div>
                        <Label htmlFor="new-room-name" className="text-base font-semibold text-gray-900">
                            {t('roomName')}
                        </Label>
                        <Input
                            id="new-room-name"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="mt-2"
                            placeholder={t('enterRoomName')}
                            autoFocus
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            {t('roomNameDesc') || 'Enter a name for your new meeting room.'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!roomName.trim()}
                        className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        {t('create')}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
