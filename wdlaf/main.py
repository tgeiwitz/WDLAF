import os
import sys

from dotenv import load_dotenv
from wdlaf.chatbot import ChatBot


def main():
    load_dotenv()

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    wd_key = os.getenv("WOODELIVERY_API_KEY")

    if not anthropic_key:
        print("Error: ANTHROPIC_API_KEY not set. Add it to your .env file or environment.")
        sys.exit(1)
    if not wd_key:
        print("Error: WOODELIVERY_API_KEY not set. Add it to your .env file or environment.")
        sys.exit(1)

    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    bot = ChatBot(anthropic_key, wd_key, model=model)

    print("WooDelivery Task Assistant")
    print("Talk to me in plain English to manage your delivery tasks.")
    print("Type 'quit' or 'exit' to leave.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        try:
            response = bot.chat(user_input)
            print(f"\nAssistant: {response}\n")
        except Exception as e:
            print(f"\nError: {e}\n")


if __name__ == "__main__":
    main()
