import { Component, ElementRef, ViewChild, signal, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiInterpreterService, AiAction } from '../../services/ai-interpreter.service';

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
  @Output() onAiAction = new EventEmitter<AiAction>();
  private aiInterpreter = inject(AiInterpreterService);

  isOpen = signal(false);
  inputText = signal('');
  isLoading = signal(false);
  selectedFile = signal<{ name: string, base64: string, mimeType: string } | null>(null);
  
  messages = signal<ChatMessage[]>([
    {
      id: 1,
      text: 'Olá! Sou seu assistente operacional do Clube Turismo Flow. Você pode me pedir para criar cotações, gerar reservas ou aplicar filtros!',
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

  public addBotMessage(text: string) {
    this.messages.update(msgs => [
      ...msgs,
      { id: Date.now(), text, sender: 'bot', timestamp: new Date() }
    ]);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  removeFile() {
    this.selectedFile.set(null);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0] as File;
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo PDF válido.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande! O limite de upload é de 10MB para análise via Inteligência.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
       const result = reader.result as string;
       const base64Data = result.split(',')[1];
       this.selectedFile.set({
         name: file.name,
         base64: base64Data,
         mimeType: 'application/pdf'
       });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset input
  }

  async sendMessage() {
    const text = this.inputText().trim();
    const file = this.selectedFile();
    
    if (!text && !file) return;

    if (text || file) {
      let displayMsg = text || `[Arquivo: ${file?.name}]`;
      if (text && file) displayMsg = `${text}\n[Arquivo: ${file.name}]`;
      
      this.messages.update(msgs => [
        ...msgs, 
        { id: Date.now(), text: displayMsg, sender: 'user', timestamp: new Date() }
      ]);
    }

    this.inputText.set('');
    this.selectedFile.set(null);
    this.isLoading.set(true);
    this.scrollToBottom();

    try {
      const response = await this.aiInterpreter.processMessageVercel(text, file?.base64, file?.mimeType);
      
      this.isLoading.set(false);
      this.addBotMessage(response.message);
      
      if (response.action && response.action.type !== 'NONE') {
        this.onAiAction.emit(response.action);
      }
    } catch (err: any) {
      this.isLoading.set(false);
      this.addBotMessage(`🚨 Ocorreu um erro: ${err.message || String(err)}`);
    }
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
