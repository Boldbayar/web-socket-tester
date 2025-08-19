"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

interface Message {
  type: "NEW" | "UPDATE" | "LOG" | "ERROR" | string;
  payload: unknown;
}

export default function WebSocketTester() {
  const [wsUrl, setWsUrl] = useState("http://my-socket-server");
  const [useAuth, setUseAuth] = useState(false);
  const [token, setToken] = useState("");

  const [subscriptions, setSubscriptions] = useState<string[]>([
    "/user/queue/notifications",
  ]);
  const [channelInput, setChannelInput] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const stompClientRef = useRef<Client | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const connect = () => {
    if (stompClientRef.current) return;

    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: useAuth ? { "x-auth-token": token } : {},
      debug: (str) => {
        console.log(str);
        setMessages((prev) => [...prev, { type: "LOG", payload: str }]);
      },
      reconnectDelay: 5000,
    });

    client.onConnect = () => {
      console.log("Connected to WebSocket");
      setConnected(true);

      subscriptions.forEach((subChannel) => {
        client.subscribe(subChannel, (msg) => {
          const data = JSON.parse(msg.body);
          setMessages((prev) => [
            ...prev,
            { type: `CHANNEL: ${subChannel}`, payload: data },
          ]);
          if (data.unreadCount) setUnreadCount(data.unreadCount);
        });
      });
    };

    client.onStompError = (frame) => {
      console.error("STOMP error:", frame);
      setMessages((prev) => [
        ...prev,
        { type: "ERROR", payload: JSON.stringify(frame, null, 2) },
      ]);
    };

    client.onWebSocketClose = () => {
      console.log("WebSocket closed");
      setMessages((prev) => [
        ...prev,
        { type: "LOG", payload: "WebSocket closed" },
      ]);
      setConnected(false);
      stompClientRef.current = null;
    };

    client.activate();
    stompClientRef.current = client;
  };

  const disconnect = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
      setConnected(false);
    }
  };

  const addSubscription = () => {
    if (channelInput && !subscriptions.includes(channelInput)) {
      setSubscriptions([...subscriptions, channelInput]);
      setChannelInput("");
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const removeSubscription = (ch: string) => {
    setSubscriptions(subscriptions.filter((s) => s !== ch));
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="p-4 mt-10 max-w-3xl mx-auto">
      <CardContent className="space-y-3">
        <Input
          placeholder="WebSocket URL"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={useAuth}
            onCheckedChange={(checked) => setUseAuth(!!checked)}
          />
          <span>Use Authentication</span>
        </div>
        {useAuth && (
          <Input
            placeholder="JWT Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        )}

        <div className="flex space-x-2">
          <Input
            placeholder="Add subscription channel"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
          />
          <Button onClick={addSubscription}>Add Channel</Button>
          <Button onClick={clearMessages}>Clear</Button>
        </div>

        {subscriptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {subscriptions.map((ch) => (
              <Button
                key={ch}
                variant="outline"
                size="sm"
                onClick={() => removeSubscription(ch)}
              >
                {ch} ×
              </Button>
            ))}
          </div>
        )}

        <div className="flex space-x-2 mt-3">
          <Button onClick={connect} disabled={connected}>
            Connect
          </Button>
          <Button onClick={disconnect} disabled={!connected}>
            Disconnect
          </Button>
          {unreadCount > 0 && (
            <span className="ml-2 font-bold">Unread: {unreadCount}</span>
          )}
        </div>

        {messages && messages.length > 0 && (
          <div className="mt-4 max-h-96 overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
            {messages.map((msg, idx) => (
              <Card
                key={idx}
                className={`p-2 ${
                  msg.type.startsWith("ERROR")
                    ? "bg-red-100 border-red-400"
                    : msg.type.startsWith("LOG")
                    ? "bg-gray-100 border-gray-300"
                    : "bg-white border-gray-200"
                }`}
              >
                <CardContent>
                  <div className="font-bold">{msg.type}</div>
                  <pre className="text-xs break-words whitespace-pre-wrap">
                    {JSON.stringify(msg.payload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
            <div ref={messageEndRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
