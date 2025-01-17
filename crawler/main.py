from datetime import datetime
import time
import urllib.parse
import requests
from bs4 import BeautifulSoup
from browser_use.browser.browser import Browser, BrowserContext 
from browser_use.agent.views import AgentHistoryList, ActionResult
import asyncio
import re
import random
import string
import re
import urllib
import requests
import logging
from os import getenv
import asyncio
import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr
import logging

from browser_use import Agent
from config import states

def init_env():
    # Load environment variables from .env file
    load_dotenv()
    
    # Check for required environment variables
    required_vars = ['GEMINI_API_KEY', 'email', 'passwd', 'access_token']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


logger = logging.getLogger()

load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
	raise ValueError('GEMINI_API_KEY is not set')

llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash-exp', api_key=SecretStr(api_key))

email = os.getenv('email')
passwd = os.getenv('passwd')
access_token = os.getenv('access_token')

async def login(context: BrowserContext):
    agent = Agent(
        task=(
            f'Go to linkedin,  login with email={email}, password={passwd} as credential'
        ),
        llm=llm,
        browser_context=context,
        max_actions_per_step=4,
        tool_call_in_content=False,
    )

    result: AgentHistoryList = await agent.run(max_steps=10)
    if not result.final_result() or not "success" in result.final_result().lower():
        raise ValueError("failed to login")


async def scrape(url, context: BrowserContext):
    page = await context.get_current_page()
    await page.goto(url)
    content = await page.content()
    soup = BeautifulSoup(content, 'html.parser')
    text_content = soup.get_text()

    match = re.search(r'About ([\d,]+) results', text_content)
    if match:
        num_results = match.group(1).replace(',', '')
        logger.info(f'Number of results: {num_results}')
    else:
        logger.warning('Number of results not found')

base_url = "https://www.linkedin.com/search/results/people"
param_geo = "geoUrn" # ["105048220"] or something
param_keywords = "keywords" # DEI
param_origin = "origin" # FACETED_SEARCH
param_sid = "sid"


def new_session() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=3))

class StateHitResult:
    def __init__(self, state: str, hit: int, date: str):
        self.state = state
        self.hit = hit 
        self.date = date

    def to_dict(self):
        return {
            "state": self.state,
            "hit": self.hit,
            "date": self.date
        }

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            state=data["state"],
            hit=data["hit"],
            date=data["date"]
        )


def post_hit_result(result: StateHitResult):
    # Get access token from environment
    access_token = getenv("access_token")

    # Prepare headers with bearer token
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Post the result
    response = requests.post(
        "https://api.pagin.org/add_result",
        headers=headers,
        json=result.to_dict()
    )

    # Log the response
    logging.info(f"API Response: {response.status_code} - {response.text}")

    # Raise exception if request failed
    response.raise_for_status()

async def scrape_state(context: BrowserContext, state: dict) -> StateHitResult:
    # Construct URL with parameters
    params = {
        param_geo: f'["{state["geoUrn"]}"]',
        param_keywords: "DEI", 
        param_origin: "FACETED_SEARCH",
        param_sid: new_session()
    }
    
    # Build full URL with parameters
    search_url = f"{base_url}/?{'&'.join(f'{k}={urllib.parse.quote(v)}' for k,v in params.items())}"
    
    page = await context.get_current_page()
    await page.goto(search_url)
    await page.wait_for_load_state()
    
    # Get page content
    content = await page.content()
    # Parse HTML content using BeautifulSoup
    soup = BeautifulSoup(content, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
        
    # Get text content
    text = soup.get_text()
    
    # Break into lines and remove leading/trailing space
    lines = (line.strip() for line in text.splitlines())
    
    # Break multi-headlines into a line each
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    
    # Drop blank lines
    text = ' '.join(chunk for chunk in chunks if chunk)

    logger.debug(f'text is {text}')
    # Extract number of results using regex
    results_pattern = r'".*?([\d,]+)\s+results?"'
    match = re.search(results_pattern, text)
    if match:
        num_results = int(match.group(1).replace(',', ''))
    else:
        num_results = 0
    logger.info(f"Found {num_results} results for {state['state']}")
    result = StateHitResult(state=state["state"], hit=num_results, date=datetime.now().strftime("%Y-%m-%d"))
    return result

async def run(state_filter: str | None = None):
    browser = Browser()
    async with await browser.new_context() as context:
        await login(context)
        results: list[StateHitResult] = []
        
        # Filter states if state_filter is provided
        states_to_process = states
        if state_filter:
            states_to_process = [s for s in states if s['state'].lower() == state_filter.lower()]
            if not states_to_process:
                logger.warning(f"No matching state found for filter: {state_filter}")
                return
            
        for state in states_to_process:
            result = await scrape_state(context, state)
            results.append(result)
            try:
                post_hit_result(result)
            except Exception:
                logger.exception("Failed to post hit result")
            await asyncio.sleep(20)
        
        logger.info(f'final results are {results}')

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LinkedIn DEI Scraper")
    parser.add_argument('--state', type=str, help='Process specific state only')
    args = parser.parse_args()
    
    logger.info("Starting LinkedIn scraping process")
    while True:
        try:
            logger.info("Beginning new scraping run")
            asyncio.run(run(args.state))
            logger.info("Completed scraping run successfully")
            
            sleep_duration = 12 * 60 * 60  # 10 hours in seconds
            logger.info(f"Sleeping for {sleep_duration/3600:.1f} hours before next run")
            time.sleep(sleep_duration)
                
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt, shutting down gracefully")
            break
        except Exception as e:
            logger.error(f"Fatal error in main loop: {str(e)}")
            logger.exception("Full exception details:")
            logger.info("Sleeping for 30 minutes before retrying")
            time.sleep(30 * 60)  # 30 minutes in seconds
