import os
import io
import json
import sys
import requests
from google.cloud import vision
from google.protobuf.json_format import MessageToDict

def classify_business_card_info(text):
    """Groq API를 통한 데이터 분류"""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        print("⚠️ GROQ_API_KEY 환경변수가 설정되지 않았습니다!", file=sys.stderr)
        return {"error": "API 키가 설정되지 않음"}
        
    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {
                "role": "system",
                "content": """당신은 명함 정보 추출 전문가입니다. OCR로 추출된 텍스트에서 다음 정보를 찾아 정확한 JSON 형식으로 반환해주세요.

                필수 추출 필드:
                - name: 사람 이름 (한글, 영문, 한자 모두 가능)
                - contact: 전화번호 (010-1234-5678, 02-123-4567, +82-10-1234-5678 등 모든 형태)
                - email: 이메일 주소 (@가 포함된 이메일)
                - organization: 회사명, 기관명, 단체명 (주식회사, 재단법인, 협회 등 포함)
                - position: 직책, 직급, 역할 (대표이사, 부장, 팀장, 연구원, CEO, CTO 등)
                - sns_links: SNS 계정 정보 (카카오톡 ID, 인스타그램, 페이스북, 트위터 등)

                응답은 반드시 다음 JSON 형식이어야 합니다:
                {
                  "name": "추출된 이름",
                  "contact": "추출된 전화번호", 
                  "email": "추출된 이메일",
                  "organization": "추출된 조직명",
                  "position": "추출된 직책",
                  "sns_links": "추출된 SNS 정보"
                }

                정보가 없으면 null을 사용하세요. JSON 결과값 외의 다른 텍스트는 절대 포함하지 마세요."""
            },
            {
                "role": "user",
                "content": f"다음 명함 텍스트에서 정보를 추출해주세요:\n\n{text}"
            }
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
        "top_p": 0.9,
        "stream": False
    }

    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        
        if "choices" in result and len(result["choices"]) > 0:
            ai_response = result["choices"][0]["message"]["content"].strip()
            
            # JSON 형식 응답 추출
            try:
                if "```json" in ai_response:
                    json_str = ai_response.split("```json")[1].split("```")[0].strip()
                elif "```" in ai_response:
                    json_str = ai_response.split("```")[1].strip()
                else:
                    start = ai_response.find('{')
                    end = ai_response.rfind('}') + 1
                    if start != -1 and end != -1:
                        json_str = ai_response[start:end]
                    else:
                        json_str = ai_response

                parsed_data = json.loads(json_str)
                return parsed_data
                
            except json.JSONDecodeError as e:
                return {
                    "name": None,
                    "contact": None,
                    "email": None,
                    "organization": None,
                    "position": None,
                    "sns_links": None,
                    "error": "JSON 파싱 오류",
                    "raw_response": ai_response
                }
        else:
            return {"error": "API 응답에 예상된 형식이 없습니다.", "raw_response": result}
            
    except requests.exceptions.Timeout:
        return {"error": "API 요청 타임아웃 (30초)"}
    except requests.exceptions.RequestException as e:
        return {"error": f"API 요청 오류: {str(e)}"}
    except Exception as e:
        return {"error": f"예상치 못한 오류: {str(e)}"}

def process_business_card(image_path):
    """명함 이미지 처리 메인 함수"""
    try:
        # Google Vision API 클라이언트 생성
        client = vision.ImageAnnotatorClient()

        # 이미지 로드
        with io.open(image_path, "rb") as image_file:
            content = image_file.read()
        image = vision.Image(content=content)

        # OCR 요청
        response = client.document_text_detection(image=image)

        if response.error.message:
            raise Exception(f'Google Vision API 오류: {response.error.message}')

        # OCR 결과 추출
        if response.text_annotations:
            extracted_text = response.text_annotations[0].description
            
            # 명함 정보 분류
            card_info = classify_business_card_info(extracted_text)
            
            # 최종 결과물 생성
            final_result = {
                "name": card_info.get("name"),
                "contact": card_info.get("contact"),
                "email": card_info.get("email"),
                "organization": card_info.get("organization"),
                "position": card_info.get("position"),
                "sns_links": card_info.get("sns_links"),
                "success": True
            }
            
            return final_result
        else:
            return {"error": "OCR 결과 없음", "success": False}
            
    except Exception as e:
        return {"error": str(e), "success": False}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "이미지 경로가 필요합니다", "success": False}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": "이미지 파일이 존재하지 않습니다", "success": False}))
        sys.exit(1)
    
    # 환경변수 설정 확인
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print(json.dumps({"error": "GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다", "success": False}))
        sys.exit(1)
    
    result = process_business_card(image_path)
    print(json.dumps(result, ensure_ascii=False))