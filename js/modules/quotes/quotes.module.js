import { quotes } from './quotes.data.js';

export class QuotesModule {
  constructor() {
    this.quotes = quotes;
    this.currentQuote = null;
  }

  async init() {
    console.log('💬 Inicializuji Quotes modul...');
    this.displayRandomQuote();
  }

  getRandomQuote() {
    const randomIndex = Math.floor(Math.random() * this.quotes.length);
    return this.quotes[randomIndex];
  }

  displayRandomQuote() {
    this.currentQuote = this.getRandomQuote();

    const quoteElement = document.querySelector('#motivational-quote');
    if (quoteElement) {
      quoteElement.textContent = this.currentQuote;
      console.log('💬 Zobrazuji citát:', this.currentQuote);
    }
  }

  refreshQuote() {
    this.displayRandomQuote();
  }
}
