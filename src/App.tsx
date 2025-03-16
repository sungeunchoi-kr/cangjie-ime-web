import { useCallback, useState } from 'react'
import './App.css'
import cjtable from './cangjie_table.json'

type ImeState = {
    memory: string
    text: string
    candidates: string[]
}

function newImeState(): ImeState {
    return {
        memory: '',
        text: '',
        candidates: [],
    }
}

function getRepresentativeKeys(keys: string) {
    let rep = ''

    for (const k of keys) {
        if (k === 'z') {
            rep += '*'
            continue
        } else if (k === 'x') {
            rep += '難'
            continue
        }

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

type Digits = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

const queryTable = (key: string) => {
    const cands = (cjtable as Record<string, string[]>)[key]
    if (!cands || cands.length === 0) {
        return []
    }
    return cands.filter(c => c.length <= 1)
}

const imeCompose = (state: ImeState | null, incomingKey: string, controlKey: 'backspace' | Digits | null): [ImeState, string] => {
    const nextState = state ? { ...state } : newImeState()

    if (incomingKey) {
        nextState.memory += incomingKey
    } else if (controlKey === 'backspace') {
        nextState.memory = nextState.memory.slice(0, -1)
    } else if (controlKey && controlKey.length === 1 && controlKey >= '1' && controlKey <= '9') {
        // get the nth candidate
        const i = parseInt(controlKey)
        const selection = (state?.candidates || [])[i - 1]
        if (selection) {
            nextState.text = selection
            return [nextState, 'commit']
        } else {
            return [nextState, '']
        }
    }

    if (nextState.memory.length === 0) {
        nextState.text = ''
        return [nextState, 'commit']
    }

    // derive value from memory
    let cands = queryTable(nextState.memory)
    if (!cands || cands.length === 0) {
        // Find the closest matching key by appending a character to memory
        // and checking if it exists in the table, until we find a match
        cands = []
        for (let i = 0; i < 26; i++) {
            const k = nextState.memory + String.fromCharCode(97 + i)
            const cs = queryTable(k)
            if (cs && cs.length > 0) {

                cands = cands.concat(cs)
                if (cands.length > 10) {
                    break
                }
            }
        }
    }

    if (cands && cands.length > 0) {
        nextState.text = cands[0]
        nextState.candidates = cands.slice(1)
    }

    return [nextState, '']
}

function App() {
    const [fontSize, setFontSize] = useState(20)

    return (
        <div className="bg-gray-900 text-white flex flex-col items-center justify-center p-4 gap-4">
            <CangJieTextArea className="w-full max-w-4xl h-96 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                fontSize={fontSize} />
            <FontSizeInput fontSize={fontSize} setFontSize={setFontSize} />
        </div>
    )
}

function FontSizeInput({
    fontSize,
    setFontSize,
}: {
    fontSize: number
    setFontSize: (fontSize: number) => void
}) {
    const commonSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96, 128]

    return (
        <div className="flex items-center gap-2">
            <label htmlFor="fontSize">Font Size:</label>
            <div className="flex items-center gap-2">
                <select
                    id="fontSize"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                >
                    {commonSizes.map(size => (
                        <option key={size} value={size}>
                            {size}px
                        </option>
                    ))}
                </select>
            </div>
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
    const [imeState, setImeState] = useState<ImeState | null>(null)
    const [value, setValue] = useState('')
    const [cursorPosition, setCursorPosition] = useState<{ top: number; left: number } | null>(null)
    const [isMobile] = useState(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

    const isImeComposing = imeState !== null

    const imeCommit = (s: ImeState | null) => {
        if (s) {
            setValue(v => v + s.text)
            setImeState(null)
        }
    }

    const handleSelect = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition(getCursorPosition(event))
    }, [])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // NOTE: event.key === 'Backspace' only handled by keydown mobile
        if (isMobile && event.key !== 'Backspace') {
            return
        }

        console.log('handleKeyDown: event=%O.', event)

        if (event.code === 'Space') {
            imeCommit(imeState)
            return
        } else if (event.code === 'Backspace' || event.key === 'Backspace') {
            if (imeState) {
                setImeState(s => {
                    const [newState, action] = imeCompose(s, '', 'backspace')
                    if (action === 'commit') {
                        imeCommit(newState)
                    }
                    return newState
                })
            } else {
                setValue(v => v.slice(0, -1))
            }
            return
        } else if (event.code === 'Enter') {
            imeCommit(imeState)
            setValue(v => v + '\n')
            return
        }

        let key = event.code.replace('Key', '').toLowerCase()
        key = key.replace('digit', '').toLowerCase()

        if (key && key.length === 1 && key >= 'a' && key <= 'z') {
            const s = imeState
            const [newState, action] = imeCompose(s, key, null)
            if (action === 'commit') {
                imeCommit(newState)
                return null
            }
            setImeState(newState)
            return
        } else if (key && key.length === 1 && key >= '1' && key <= '9') {
            const s = imeState
            const [newState, action] = imeCompose(s, '', key as Digits)
            if (action === 'commit') {
                imeCommit(newState)
                return null
            }
            setImeState(newState)
            return
        }
    }

    const handleInput = (ev: React.FormEvent<HTMLTextAreaElement>) => {
        if (!isMobile) {
            return
        }

        console.log('handleInput: ev=%O', ev)

        // @ts-expect-error - data
        const key = (ev.nativeEvent.data || '').toLowerCase() // 'a', ' ', '1', etc
        // @ts-expect-error - inputType
        const inputType = ev.nativeEvent.inputType // 'insertLineBreak'
        console.log('handleInput: key=%O, inputType=%O', key, inputType)


        if (key === ' ') {
            imeCommit(imeState)
            return
        } else if (key === 'Backspace') { // TODO: does not work
            if (imeState) {
                setImeState(s => {
                    const [newState, action] = imeCompose(s, '', 'backspace')
                    if (action === 'commit') {
                        imeCommit(newState)
                    }
                    return newState
                })
            } else {
                setValue(v => v.slice(0, -1))
            }
            return
        } else if (inputType === 'insertLineBreak') {
            imeCommit(imeState)
            setValue(v => v + '\n')
            return
        }

        if (key && key.length === 1 && key >= 'a' && key <= 'z') {
            const s = imeState
            const [newState, action] = imeCompose(s, key, null)
            if (action === 'commit') {
                imeCommit(newState)
                return null
            }
            setImeState(newState)
            return
        } else if (key && key.length === 1 && key >= '1' && key <= '9') {
            const s = imeState
            const [newState, action] = imeCompose(s, '', key as Digits)
            if (action === 'commit') {
                imeCommit(newState)
                return null
            }
            setImeState(newState)
            return
        }
    }

    console.log('Render.')

    return (
        <div className="w-full">
            {/* <div>
                <p>Cursor Position (X, Y): ({cursorPosition?.top.toFixed(2)}, {cursorPosition?.left.toFixed(2)})</p>
            </div> */}
            <textarea
                className={'relative ' + className}
                style={{ fontSize: fontSize + 'px' }}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onSelect={handleSelect}
                value={value}
            />

            {isImeComposing && cursorPosition && (
                <div
                    className="absolute z-10 rounded pl-0 pr-1 py-1"
                    style={{
                        top: cursorPosition.top,
                        left: cursorPosition.left,
                        fontSize: (fontSize + 1) + 'px',
                        width: '8ch',
                    }}
                >
                    <div className='absolute top-[-10px] text-sm bg-gray-700 rounded text-left px-[2px]'>{getRepresentativeKeys(imeState.memory)}</div>

                    <div className="flex gap-1">
                        {imeState.text && (
                            <span>{imeState.text}</span>
                        )}
                    </div>

                    {imeState.candidates.length > 0 && (
                        <div className='flex flex-col items-start leading-[1.1] text-[18px] bg-gray-700 rounded py-[2px] px-1 max-h-[15vh] sm:max-h-[20vh] md:max-h-[25vh] overflow-y-auto'>
                            {imeState.candidates.map((candidate, i) => (
                                <span key={i} className="text-gray-200">
                                    <span className='text-[14px]'>{i + 1}. </span>{candidate}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default App
