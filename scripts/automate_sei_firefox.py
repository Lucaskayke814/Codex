from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import NoSuchElementException, WebDriverException, TimeoutException
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

CPF_VALUE = "70187756635"
PASSWORD_VALUE = "Lucas87970577@"
ORGAO_VALUE = "SEPLAG"
TARGET_URL = "https://sei.mg.gov.br"


def find_field(driver, keywords, tags=("input", "select", "textarea")):
    selectors = []
    for tag in tags:
        for keyword in keywords:
            selectors.extend([
                f"{tag}[name*='{keyword}']",
                f"{tag}[id*='{keyword}']",
                f"{tag}[placeholder*='{keyword}']",
                f"{tag}[aria-label*='{keyword}']",
                f"{tag}[title*='{keyword}']",
            ])
    for selector in selectors:
        try:
            element = driver.find_element(By.CSS_SELECTOR, selector)
            if element.is_displayed() and element.is_enabled():
                return element
        except NoSuchElementException:
            continue

    labels = driver.find_elements(By.TAG_NAME, "label")
    for label in labels:
        label_text = label.text.strip().upper()
        if any(keyword.upper() in label_text for keyword in keywords):
            try:
                target_id = label.get_attribute("for")
                if target_id:
                    element = driver.find_element(By.ID, target_id)
                    if element.is_displayed() and element.is_enabled():
                        return element
            except NoSuchElementException:
                continue

    raise NoSuchElementException(f"Não foi possível localizar o campo para: {keywords}")


def fill_field(driver, keywords, value):
    element = find_field(driver, keywords)
    element.clear()
    element.send_keys(value)
    return element


def main():
    options = Options()
    options.add_argument("-private")
    # Remova headless se quiser ver o Firefox.
    options.headless = False

    try:
        service = Service()
        driver = webdriver.Firefox(service=service, options=options)
    except WebDriverException as exc:
        print("Erro ao iniciar o Firefox WebDriver. Verifique se o geckodriver está instalado e no PATH.")
        print(exc)
        return

    try:
        driver.get(TARGET_URL)
        time.sleep(5)

        fill_field(driver, ["cpf"], CPF_VALUE)
        fill_field(driver, ["senha", "password", "passwd"], PASSWORD_VALUE)
        fill_field(driver, ["orgao", "órgão", "orgao"], ORGAO_VALUE)

        print(f"Campos preenchidos: CPF={CPF_VALUE}, senha=[OCULTA], orgão={ORGAO_VALUE}")
    except NoSuchElementException as exc:
        print("Erro: não foi possível localizar um dos campos necessários na página.")
        print(exc)
    except Exception as exc:
        print("Ocorreu um erro durante a automação.")
        print(exc)
    finally:
        time.sleep(5)
        driver.quit()


if __name__ == "__main__":
    main()
