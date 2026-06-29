import { useState } from 'react';
import { addDoc, tenantCol, logAudit } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;
}

interface Chat {
  id: string;
  type: string;
  participants: string[];
}

export default function MessengerApp({ currentUserId }: { currentUserId: string }) {
  const { data: chats } = useFirestoreCollection<Chat>(tenantCol('core_chats'));
  const { data: messages } = useFirestoreCollection<Message>(tenantCol('core_messages'));
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [text, setText] = useState('');

  const myChats = chats.filter((c) => c.participants?.includes(currentUserId));
  const chatMessages = messages.filter((m) => m.chatId === activeChat).sort((a, b) => a.timestamp - b.timestamp);

  const send = async () => {
    if (!text.trim() || !activeChat) return;
    await addDoc(tenantCol('core_messages'), {
      id: `m_${Date.now()}`, chatId: activeChat, senderId: currentUserId, text: text.trim(), timestamp: Date.now(),
    });
    setText('');
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 bg-white p-3">
        <h2 className="font-bold text-sm text-slate-500 mb-3">Chats</h2>
        {myChats.map((c) => (
          <button key={c.id} onClick={() => setActiveChat(c.id)}
            className={`block w-full text-left p-2 rounded-lg text-sm mb-1 ${activeChat === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}>
            {c.type === 'direct' ? 'Direct Chat' : c.id}
          </button>
        ))}
        {myChats.length === 0 && <p className="text-xs text-slate-400">No chats yet</p>}
      </div>
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${m.senderId === currentUserId ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                className="flex-1 p-2 border rounded-lg" placeholder="Type a message..." />
              <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Send</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">Select a chat</div>
        )}
      </div>
    </div>
  );
}
