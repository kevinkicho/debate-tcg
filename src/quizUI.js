/* --- Quiz UI Styles --- */
#quiz-modal {
    background: #ffeaa7;
    border: 3px solid #fdcb6e;
    padding: 25px;
    margin-bottom: 20px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

/* Multiple Choice Buttons */
.mc-btn {
    display: block;
    width: 100%;
    margin: 10px 0;
    padding: 12px;
    background: white;
    border: 2px solid #3498db;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
}
.mc-btn:hover { background: #e8f4f8; }

/* Fill in the Blank Styles */
.fib-sentence {
    font-size: 18px;
    line-height: 2;
    margin-bottom: 20px;
}
.fib-blank {
    display: inline-block;
    min-width: 100px;
    height: 30px;
    border-bottom: 3px solid #e74c3c;
    margin: 0 5px;
    text-align: center;
    font-weight: bold;
    color: #c0392b;
    cursor: pointer;
}
.fib-wordbank button {
    margin: 5px;
    padding: 8px 15px;
    background: #ecf0f1;
    border: 1px solid #bdc3c7;
    border-radius: 20px;
    cursor: pointer;
}

/* Rapid Typing Styles */
#typing-target {
    font-size: 24px;
    font-weight: bold;
    letter-spacing: 2px;
    color: #2c3e50;
    margin: 20px 0;
}
#typing-input {
    font-size: 20px;
    padding: 10px;
    width: 80%;
    text-align: center;
    border: 2px solid #2980b9;
    border-radius: 5px;
}