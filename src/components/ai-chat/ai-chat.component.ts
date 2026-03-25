import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html'
})
export class AiChatComponent {
  isOpen = signal(false);
  inputText = signal('');
  
  messages = signal<ChatMessage[]>([
    {
      id: 1,
      text: 'Olá! Sou seu assistente virtual do Clube Turismo Flow. Como posso te ajudar hoje?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);

  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  toggleChat() {
    this.isOpen.update(val => !val);
    if (this.isOpen()) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  closeChat() {
    this.isOpen.set(false);
  }

  sendMessage() {
    const text = this.inputText().trim();
    if (!text) return;

    // Adiciona mensagem do usuário
    this.messages.update(msgs => [
      ...msgs, 
      {
        id: Date.now(),
        text,
        sender: 'user',
        timestamp: new Date()
      }
    ]);

    this.inputText.set('');
    this.scrollToBottom();

    // Simula delay de resposta do bot (Mock)
    setTimeout(() => {
      this.messages.update(msgs => [
        ...msgs,
        {
          id: Date.now() + 1,
          text: 'Desculpe! Ainda estou em desenvolvimento, mas logo estarei com vida para te auxiliar da melhor forma no sistema Clube Turismo Flow.',
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
      this.scrollToBottom();
    }, 800);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }
}
