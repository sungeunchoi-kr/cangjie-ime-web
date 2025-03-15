import { useCallback, useState } from 'react'
import './App.css'
import cjtable from './cangjie_table.json'

type ImeComposingState = {
    memory: string
    text: string
    candidates: string[]
}

function newImeComposingState(): ImeComposingState {
    return {
        memory: '',
        text: '',
        candidates: []
    }
}

function getRepresentativeKeys(keys: string) {
    let rep = ''
    for (const k of keys) {
        try {
            const ck = (cjtable as Record<string, string[]>)[k][0]
            rep += ck
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
            rep += '?'
        }
    }
    return rep
}

/**
 * returns x, y coordinates for absolute positioning of a span within a given text input
 * at a given selection point
 * @param {object} input - the input element to obtain coordinates for
 * @param {number} selectionPoint - the selection point for the input
 */
const getCursorXY = (input: HTMLTextAreaElement, selectionPoint: number) => {
    const {
        offsetLeft: inputX,
        offsetTop: inputY,
    } = input
    // create a dummy element that will be a clone of our input
    const div = document.createElement('div')
    // get the computed style of the input and clone it onto the dummy element
    const copyStyle = getComputedStyle(input)
    for (const prop of copyStyle) {
        // @ts-expect-error - style copy
        div.style[prop] = copyStyle[prop]
    }
    // we need a character that will replace whitespace when filling our dummy element if it's a single line <input/>
    const swap = '.'
    const inputValue = input.tagName === 'INPUT' ? input.value.replace(/ /g, swap) : input.value
    // set the div content to that of the textarea up until selection
    const textContent = inputValue.substr(0, selectionPoint)
    // set the text content of the dummy element div
    div.textContent = textContent
    if (input.tagName === 'TEXTAREA') div.style.height = 'auto'
    // if a single line input then the div needs to be single line and not break out like a text area
    if (input.tagName === 'INPUT') div.style.width = 'auto'
    // create a marker element to obtain caret position
    const span = document.createElement('span')
    // give the span the textContent of remaining content so that the recreated dummy element is as close as possible
    span.textContent = inputValue.substr(selectionPoint) || '.'
    // append the span marker to the div
    div.appendChild(span)
    // append the dummy element to the body
    document.body.appendChild(div)
    // get the marker position, this is the caret position top and left relative to the input
    const { offsetLeft: spanX, offsetTop: spanY } = span
    // lastly, remove that dummy element
    // NOTE:: can comment this out for debugging purposes if you want to see where that span is rendered
    document.body.removeChild(div)
    // return an object with the x and y of the caret. account for input positioning so that you don't need to wrap the input
    return {
        x: inputX + spanX,
        y: inputY + spanY,
    }
}

function getCursorPosition(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;

    const {
        offsetLeft,
        offsetTop,
        offsetHeight,
        offsetWidth,
        scrollLeft,
        scrollTop,
        selectionEnd,
    } = textarea
    // get style property values that we are interested in
    const { lineHeight, paddingRight } = getComputedStyle(textarea)
    // get the caret X and Y from our helper function
    const { x, y } = getCursorXY(textarea, selectionEnd)
    // set the marker positioning
    // for the left positioning we ensure that the maximum left position is the width of the input minus the right padding using Math.min
    // we also account for current scroll position of the input
    const newLeft = Math.min(
        x - scrollLeft,
        (offsetLeft + offsetWidth) - parseInt(paddingRight, 10)
    )
    // for the top positioning we ensure that the maximum top position is the height of the input minus line height
    // we also account for current scroll position of the input
    const newTop = Math.min(
        y - scrollTop,
        (offsetTop + offsetHeight) - parseInt(lineHeight, 10)
    )

    return {
        top: newTop - 5,
        left: newLeft,
    }
}

const imeCompose = (state: ImeComposingState | null, incomingKey: string, controlKey: 'backspace' | null) => {
    const nextState = state ? { ...state } : newImeComposingState()

    if (incomingKey) {
        nextState.memory += incomingKey
    } else if (controlKey === 'backspace') {
        nextState.memory = nextState.memory.slice(0, -1)
    }

    if (nextState.memory.length === 0) {
        return null
    }

    // derive value from memory
    let cand = (cjtable as Record<string, string[]>)[nextState.memory]
    if (!cand || cand.length === 0) {
        // Find the closest matching key by appending a character to memory
        // and checking if it exists in the table, until we find a match
        cand = []
        for (let i = 0; i < 26; i++) {
            const k = nextState.memory + String.fromCharCode(97 + i)
            const c = (cjtable as Record<string, string[]>)[k]
            if (c && c.length > 0) {
                cand = cand.concat(c)
                if (cand.length > 10) {
                    break
                }
            }
        }
    }
    if (cand && cand.length > 0) {
        nextState.text = cand[0]
        nextState.candidates = cand
    }

    return nextState
}

function App() {
    return (
        <div className="bg-gray-900 text-white flex items-center justify-center p-4">
            <CangJieTextArea className="w-full max-w-4xl h-96 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                fontSize={20} />
        </div>
    )
}

function CangJieTextArea({
    className,
    fontSize = 16,
}: {
    className?: string
    fontSize?: number
}) {
    const [imeComposingValue, setImeComposingValue] = useState<ImeComposingState | null>(null)
    const [value, setValue] = useState('')
    const [cursorPosition, setCursorPosition] = useState<{ top: number; left: number } | null>(null)

    const isImeComposing = imeComposingValue !== null

    const imeCommit = () => {
        if (imeComposingValue) {
            setValue(v => v + imeComposingValue.text)
            setImeComposingValue(null)
        }
    }

    const handleSelect = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition(getCursorPosition(event))
    }, [])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.code === 'Space') {
            imeCommit()
            return
        } else if (event.code === 'Backspace') {
            if (imeComposingValue) {
                setImeComposingValue(s => imeCompose(s, '', 'backspace'))
            } else {
                setValue(v => v.slice(0, -1))
            }
            return
        } else if (event.code === 'Enter') {
            imeCommit()
            setValue(v => v + '\n')
            return
        }

        const key = event.code.replace('Key', '').toLowerCase()

        if (key && key.length === 1 && key >= 'a' && key <= 'z') {
            setImeComposingValue(s => {
                const newState = imeCompose(s, key, null)
                return newState
            })
            return
        }
    }

    return (
        <div className="w-full">
            <div>
                <p>Cursor Position (X, Y): ({cursorPosition?.top.toFixed(2)}, {cursorPosition?.left.toFixed(2)})</p>
            </div>
            <textarea
                className={'relative ' + className}
                style={{ fontSize: fontSize + 'px' }}
                onKeyDown={handleKeyDown}
                onSelect={handleSelect}
                value={value}
            />

            {isImeComposing && cursorPosition && (
                <div
                    className="absolute z-10 bg-gray-700 rounded px-1 py-1"
                    style={{
                        top: cursorPosition.top,
                        left: cursorPosition.left,
                        fontSize: (fontSize + 1) + 'px',
                    }}
                >
                    <div className="flex gap-1">
                        {imeComposingValue.candidates.map((candidate, i) => (
                            <span key={i} className={i === 0 ? '' : 'text-blue-400'}>
                                {candidate}
                            </span>
                        ))}
                    </div>
                    <div className='text-sm text-left'>{getRepresentativeKeys(imeComposingValue.memory)}</div>
                </div>
            )}
        </div>
    )
}

export default App
