import React, { useEffect, useRef, useState } from 'react'
import logo from './logo.svg'
import './App.css'
import Input from '@material-ui/core/Input'
// @ts-ignore
import getCaretCoordinates from 'textarea-caret'

import cangjieLookup from './cangjie-lookup.json'
import ButtonGroup from '@material-ui/core/ButtonGroup'
import Button from '@material-ui/core/Button'

interface IMEViewData {
    top: number|string
    left: number|string,
    height: number|string,
    topPlusHeight: number|string,
    progressString: string
    candidateList: CandidateListItem[]
}

function App() {

    const [ inputText, set_inputText ] = useState<string>('12345')
    const [ selectionEnd, set_selectionEnd ] = useState<number>(0)
    const [ imeUpdateKey, set_imeUpdateKey ] = useState<{}>({})
    const [ imeCandidateDiv, set_imeCandidateDiv ] = useState<IMEViewData>({top:0, left:0, height:0, topPlusHeight:0, progressString:'', candidateList:[]})

    const inputRef = useRef<HTMLTextAreaElement>(null)
    const caretPosition = useRef<number>(0)
    const ime = useRef<IME>(new IME())

    console.log('rendering')

    useEffect(() => {
    }, [])

    useEffect(() => {
        if (inputRef.current && caretPosition.current != null) {
            console.log(`set selectioStart to ${caretPosition.current}.`)
            inputRef.current.selectionStart = caretPosition.current
            inputRef.current.selectionEnd = caretPosition.current

            const { top, left } = getCaretCoordinates(inputRef.current, caretPosition.current)
            const rect = inputRef.current.getBoundingClientRect()
            
            //const style = window.getComputedStyle(inputRef.current)
            //const lineHeight = style.getPropertyValue('line-height')
            //console.log('lineHeight=' + lineHeight)
            //const topOffset = 0 //rect.height

            set_imeCandidateDiv({
                top: `calc(${top}px + ${rect.top}px)`,
                left: left + rect.left,
                height: '20pt',
                topPlusHeight: `calc(${top}px + ${rect.top}px + 20pt)`,
                progressString: ime.current.progressString,
                candidateList: ime.current.candidateList,
            })
        }
    }, [inputText, imeUpdateKey])

    const onKeyDownHandler = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // @ts-ignore
        const keycode = ev.code

        //console.log('keycode=' + keycode)
        //const key: string|null = isKeycodeIMEAlphabet(keycode)
        //if (!key) {
        //    ime.current.clearComposing()
        //}

        let controlKey: 'Backspace'|'Enter'|'Space'|null = null
        let alphabetKey: string|null = null
        if (keycode === 'Backspace' || keycode === 'Enter' || keycode === 'Space') {
            controlKey = keycode
        } else if (keycode.length === 4 && keycode >= 'KeyA' && keycode <= 'KeyZ') {
            alphabetKey = keycode.slice(3)
        } else {
            ime.current.clearComposing()
            return
        }

        ev.preventDefault()

        const i = inputRef.current?.selectionEnd || 0
        let imeResult: IMEResult|null = null;
        if (controlKey === 'Backspace') {
            if (ime.current.isComposing()) {
                imeResult = ime.current.typeControlKey(controlKey)
            } else {
                // regular backspace
                caretPosition.current = i - 1
                set_inputText( [ inputText.slice(0, i-1), '', inputText.slice(i) ].join('') )
                return
            }
        } else if (controlKey === 'Space') {
            if (ime.current.isComposing()) {
                imeResult = ime.current.typeControlKey(controlKey)
            } else {
                // regular space
                caretPosition.current = i + 1
                set_inputText( [ inputText.slice(0, i), ' ', inputText.slice(i) ].join('') )
                return
            }
        } else if (alphabetKey) {
            imeResult = ime.current.typeKeyCode(alphabetKey)
        } else {
            console.log('unrecognized')
            return
        }

        if (imeResult) {
            applyIMEResult(imeResult)
        }
    }

    const applyIMEResult = (imeResult: IMEResult) => {
        const i = inputRef.current?.selectionEnd || 0

        const { composing, composing_prev, commit } = imeResult
        console.log(`${JSON.stringify({ composing, composing_prev, commit })}`)
        console.log(`${inputText}.slice(${i+composing_prev.length}) = ` + inputText.slice(i+composing_prev.length))
        let inputText_next = inputText
        inputText_next = [ inputText.slice(0, i-composing_prev.length), composing+commit, inputText.slice(i) ].join('')
        caretPosition.current = i + (composing.length - composing_prev.length) + commit.length
        set_inputText(inputText_next)
        set_imeUpdateKey({})
    }

    return (
        <div className='App'>
            <textarea ref={inputRef} onKeyDown={onKeyDownHandler} value={inputText} style={{fontSize:'20pt'}} rows={10}></textarea>
            <p style={{top:imeCandidateDiv.top, left: imeCandidateDiv.left, position:'absolute', fontSize:'75%', transform:'scaleY(0.9)', lineHeight:'100%', margin:0, backgroundColor:'lightgray'}}>
                {
                    [ ...imeCandidateDiv.progressString ].map(c => {
                        return <>{c}<br /></>
                    })
                }
            </p>
            <div style={{top:imeCandidateDiv.topPlusHeight, left:`calc(${imeCandidateDiv.left}px + 1.5ch)`, position:'absolute', display:'flex', alignItems:'flex-start'}}>
                <ButtonGroup color='primary' variant='contained'>
                    {
                        imeCandidateDiv.candidateList.map((candidate, i) => {
                            if (i === 0) return null
                            return (
                                <Button
                                    style={{padding:'0.1rem 0.75rem'}}
                                    onClick={() => {
                                        const imeResult = ime.current.selectFromCandidateList(candidate)
                                        applyIMEResult(imeResult)
                                        inputRef.current?.focus()
                                    }}
                                >
                                    <span style={{fontSize:'75%',marginRight:'0.75ch'}}>{candidate.selectorKeyVisual}</span>
                                    {candidate.value}
                                </Button>
                            )
                        })
                    }
                </ButtonGroup>
            </div>
        </div>
    )
}

type IMEResult = { composing: string, composing_prev: string, commit: string }
type CandidateListItem = { value: string, selectorKey: string, selectorKeyVisual: string }
class IME {

    public composingKeys: string = ''
    public composingString: string = ''
    public composingStringPrev: string = ''
    public commitString: string = ''

    public progressString: string = ''
    public candidateList: CandidateListItem[] = []

    setComposingString(s: string) {
        this.composingStringPrev = this.composingString + ''
        this.composingString = s
    }

    typeKeyCode(key: string): IMEResult {
        key = key.toLocaleLowerCase('en-US')
        console.log({ composingKeys: this.composingKeys, composingString: this.composingString })
        this.composingKeys += key
        this._transform()
        return this._toIMEResult()
    }

    typeControlKey(key: 'Enter'|'Space'|'Backspace'): IMEResult {
        console.log({ composingKeys: this.composingKeys, composingString: this.composingString })
        if (key === 'Enter' || key === 'Space') {
            this._commit()
        } else if (key === 'Backspace') {
            this.composingKeys = this.composingKeys.slice(0, this.composingKeys.length-1)
            this._transform()
        }

        return this._toIMEResult()
    }

    selectFromCandidateList(selection: CandidateListItem): IMEResult {
        this.setComposingString(selection.value)
        this._commit()
        return this._toIMEResult()
    }

    isComposing(): boolean {
        return this.composingKeys.length > 0
    }

    clearComposing(): void {
        this.composingKeys = ''
        this.composingString = ''
        this.composingStringPrev = ''
        this.commitString = ''
        this.progressString = ''
    }

    private _transform() {
        if (this.composingKeys === '') {
            this.setComposingString('')
            this.progressString = ''
            return
        }

        // @ts-ignore
        const candidates: string[]|null = cangjieLookup[this.composingKeys]
        console.log(`candidates=${JSON.stringify(candidates)}`)
        if (candidates == null || candidates.length === 0) {
            this.setComposingString(this.composingString)
        } else {
            this.candidateList = candidates.map((c,i) => ({
                value: c,
                selectorKey: i+'',
                selectorKeyVisual: i+'',
            }))
            this.setComposingString(candidates[0])
        }

        this.progressString = [...this.composingKeys].map(c => basicShapesLookup[c]||'').join('')
    }

    private _commit() {
        this.commitString = this.composingString + ''
        this.setComposingString('')
        this.composingKeys = ''
        this.progressString = ''
        this.candidateList = []
    }

    private _toIMEResult(): IMEResult {
        const commitString = this.commitString
        if (this.commitString) {
            this.commitString = ''
        }
        return { composing: this.composingString, composing_prev: this.composingStringPrev, commit: commitString }
    }
}

/**
 * The keycodes the IME understands. Keycodes not in this alphabet are completely ignored.
 */
const isKeycodeIMEAlphabet = (keycode: string) => {
    const controlKeycodes = [ 'Enter', 'Space', 'Backspace' ]
    if (keycode.startsWith('Digit')) {
        return keycode.slice('Digit'.length)
    } else if (keycode.length === 4 && keycode >= 'KeyA' && keycode <= 'KeyZ') {
        return keycode.slice('Key'.length)
    } else if (controlKeycodes.includes(keycode)) {
        return keycode
    } else {
        return null
    }
}

const basicShapesLookup: {[key:string]:string} = {
  'a': '日',
  'b': '月',
  'c': '金',
  'd': '木',
  'e': '水',
  'f': '火',
  'g': '土',
  'h': '竹',
  'i': '戈',
  'j': '十',
  'k': '大',
  'l': '中',
  'm': '一',
  'n': '弓',
  'o': '人',
  'p': '心',
  'q': '手',
  'r': '口',
  's': '尸',
  't': '廿',
  'u': '山',
  'v': '女',
  'w': '田',
  'x': '難',
  'y': '卜',
  'z': '重',
}

export default App
