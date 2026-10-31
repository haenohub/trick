---
name: LeafTale
description: 숲과 바다의 도트 판타지에 어울리는 작은 모험 창과 기록장
colors:
  field-panel: "#1e3248"
  field-raised: "#29425b"
  field-inset: "#152a3a"
  field-text: "#f3f3eb"
  field-muted: "#c5d3df"
  field-line: "#667f99"
  field-edge: "#91a8bd"
  leaf-gold: "#f0d599"
  leaf-action: "#d7dfa9"
  forest-panel: "#19392f"
  guide-paper: "#fdfcf6"
  guide-text: "#233d48"
  guide-muted: "#586d66"
  guide-line: "#c9d3ca"
typography:
  display:
    fontFamily: "LeafTitle, Noto Serif KR, serif"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "calc(12px + 2pt)"
    lineHeight: 1.75
  label:
    fontFamily: "Noto Sans KR, system-ui, sans-serif"
    fontSize: "calc(10px + 2pt)"
rounded:
  field: "3px"
  guide: "5px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  field-panel:
    backgroundColor: "{colors.field-panel}"
    textColor: "{colors.field-text}"
    rounded: "{rounded.field}"
    padding: "20px"
  guide-page:
    backgroundColor: "{colors.guide-paper}"
    textColor: "{colors.guide-text}"
    rounded: "{rounded.guide}"
---

## Overview

리프테일은 마우스로 이동하고 대상을 지정해 전투하는 브라우저 쿼터뷰 RPG다. 이 문서는 기존 숲·바다 픽셀 아트와 클래식 청회색 게임 창을 유지하며 다듬은 v0.30의 실제 구현을 기록한다. 새로운 게임 아트나 다른 브랜드를 정의하지 않는다.

게임의 테마 값과 컴포넌트 표현은 `site/interface.css`, 위치·게임 위젯의 구조는 `site/styles.css`가 담당한다. 독립 도감 테마는 `templates/guide-theme.css`이며 빌드할 때 단일 HTML 안에 삽입한다. 생성된 `site/bestiary.html`을 직접 수정하지 않는다.

## Colors

게임 창은 불투명한 청회색 본문, 은색 테두리, 어두운 입력칸을 쓴다. 그림이 글자 뒤로 비치지 않게 하고 금색은 제목과 중요한 수치에, 잎색은 선택된 분류와 주 행동에 사용한다. 시작 화면에는 기존 짙은 숲색과 나무 프레임을 유지한다.

웹 도감은 밝은 종이색 본문과 짙은 청회색 표지를 사용한다. 본문·보조 글자의 대비는 실제 배경에서 4.5:1 이상을 목표로 한다. 비활성 컨트롤은 색을 지우는 대신 상태를 식별할 수 있는 투명도를 유지한다.

## Typography

기존 전체 글꼴 증가값 `--font-increase: 2pt`를 유지한다. 게임의 일반 본문은 `--ui-body`, 분류·보조 정보는 `--ui-small`을 사용한다. 제목과 수치의 크기·굵기를 구분하며 수치는 tabular-nums로 정렬한다.

`LeafTitle`은 Noto Serif CJK KR Bold의 제목용 글자만 포함한 4,760바이트 자체 호스팅 WOFF다. 리프테일/도감 제목에만 쓰고 한국어 본문은 기존 UI 글꼴로 표시한다. 글꼴 라이선스는 `site/assets/fonts/LICENSE-Noto-CJK.txt`에 포함한다. 독립 도감에는 글꼴을 내장해 HTML 저장 후에도 제목이 유지된다.

## Layout

게임은 전체 브라우저를 사용하고 HUD는 가장자리에 둔다. UI 변경으로 카메라 확대나 월드의 도트 크기를 바꾸지 않는다. 데스크톱 창 너비는 가방 540px, 일반 창 680px, 도감·지도 760px, 설정 580px이다. 작은 화면에서는 좌우 여백 8~12px 안으로 맞추고 창 본문만 스크롤한다.

가방은 항상 한 줄 5칸이다. 아이콘 중심의 탐색과 마우스/키보드 툴팁을 유지한다. 시작 화면은 일반 데스크톱과 세로 휴대폰 화면에서 시작 버튼까지 보이며, 높이가 매우 낮은 가로 화면은 스크롤로 접근성을 보장한다.

웹 도감은 넓은 화면에서 필터와 목록의 2열이며, 760px 이하에서 필터를 접는 1열로 전환한다. 아이템·제작 아이콘은 원본 크기 64px로 보여 주며 상세정보는 기본 접힘이다.

## Elevation & Depth

읽는 창은 불투명한 표면을 사용한다. 창 그림자 `0 12px 36px #071a2a66`는 배경과 깊이를 구분하고, HUD는 작은 그림자로 절제한다. 픽셀 이미지에는 흐림 효과나 보간을 추가하지 않는다.

## Shapes

클래식 RPG의 작은 모서리와 얇은 은색 선을 유지한다. 시작 화면의 기존 나무 이미지는 64px 9-slice, 32px 표시 폭으로 분리해 장식이 본문으로 늘어나지 않게 한다. 텍스트는 프레임 안쪽의 별도 패딩에 놓는다.

## Components

- 버튼은 기본·호버·포커스·비활성 상태를 갖는다. 선택 분류에는 색과 `aria-pressed`를 함께 사용한다. 키보드 포커스는 금색 외곽선으로 표시한다.
- 창은 제목으로 이름을 부여하고 닫기 버튼, 키보드 순환과 이전 초점 복귀를 유지한다. 열림 모션은 160ms이며 reduced-motion에서는 제거한다.
- 직업 선택은 버튼을 다시 만들지 않고 눌림 상태와 설명만 바꿔 키보드 초점을 유지한다.
- 직업 창은 전투 기술과 실제 단축키를 먼저 보여 준다. 성장 능력치는 접어 두고, 펼친 상태에서 배분해도 접히지 않는다. V 상태창의 성장 수치도 계속 이용할 수 있다.
- 도감의 사용 효과·요구 조건·획득처·제작 설명은 native details/summary로 펼친다. 필터도 키보드로 열 수 있고, 검색어 지우기는 하나만 표시한다.
- UI 선 아이콘은 `site/ui-icons.js`의 24px viewBox·1.6px 선을 공유한다. 게임의 아이템·인물·몬스터는 기존 픽셀 아틀라스를 사용한다.

## Do's and Don'ts

- Do: 숲과 바다의 아트, 마우스 이동, 5열 가방, 클릭/길게 누르기 줍기, 저장·장착 동작을 유지한다.
- Do: 정보의 우선순위와 읽는 표면을 먼저 정리하고 실제 한국어·긴 아이템 이름으로 확인한다.
- Do: 320px부터 넓은 데스크톱까지 가로 넘침과 컨트롤 접근을 검증한다.
- Don't: 나무 프레임의 중앙 조각을 확대해 글자 위에 장식을 그리지 않는다.
- Don't: 유리 효과·빛 번짐·장식용 영문 소제목을 새로 더하지 않는다.
- Don't: UI 다듬기를 이유로 전투 판정·성장 수치·드롭 확률이나 픽셀 아트를 변경하지 않는다.
