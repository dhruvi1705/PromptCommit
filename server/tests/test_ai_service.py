import asyncio
from app.services.ai_service import ai_service


async def main():
    result = await ai_service.run_prompt(
        provider="Google Gemini",
        model="gemini-3.6-flash",
        prompt_text="You are a helpful AI assistant.",
        input_text="Explain what an API is in 2 simple sentences.",
        temperature=0.7,
        max_tokens=1024
    )

    print("\nStatus:", result["status"])
    print("Response Time:", result["response_time_ms"], "ms")
    print("\nResponse:")
    print(result["output_text"])

    if result["error"]:
        print("\nError:", result["error"])


if __name__ == "__main__":
    asyncio.run(main())