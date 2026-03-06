import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function CopilotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! I'm your Compliance Copilot. I know your state laws and the specific labour codes you operate under. Ask me anything!" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");

        // Add user message to UI immediately
        const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('copilot-chat', {
                body: {
                    message: userMessage,
                    history: messages.slice(1) // Avoid sending the initial greeting as context
                }
            });

            if (error) throw error;

            setMessages([...newMessages, { role: "assistant", content: data.reply }]);
        } catch (error) {
            console.error('Error invoking copilot:', error);
            setMessages([...newMessages, { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <Card className="w-80 sm:w-96 h-[500px] mb-4 shadow-xl border-border flex flex-col animate-in slide-in-from-bottom-5">
                    <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-accent text-accent-foreground rounded-t-xl space-y-0">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            <CardTitle className="text-sm font-medium">Compliance Copilot</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-accent-foreground hover:bg-black/10 hover:text-accent-foreground" onClick={() => setIsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                        <ScrollArea className="h-full px-4 py-4" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                            {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-muted rounded-tl-none whitespace-pre-wrap'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-2 flex-row">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                        <div className="px-4 py-3 rounded-2xl bg-muted rounded-tl-none flex items-center gap-1">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-3 border-t">
                        <form
                            className="flex w-full gap-2"
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        >
                            <Input
                                placeholder="Ask about labour codes, LWF..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-lg relative overflow-hidden group hover:scale-105 transition-all duration-300"
                    size="icon"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-accent to-purple-600 opacity-100 group-hover:opacity-90 transition-opacity" />
                    <MessageCircle className="h-6 w-6 text-white relative z-10" />
                </Button>
            )}
        </div>
    );
}
