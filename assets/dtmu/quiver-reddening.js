(() => {
  'use strict';
  const quiverSignature = graph => JSON.stringify([graph.vertices, graph.adjacency, [...graph.frozen].sort((a, b) => a - b)]);
  const copyGraph = graph => JSON.parse(JSON.stringify(graph));
  function formatPermutation(vertices, permutation) {
    const n = vertices.length;
    if (!Array.isArray(permutation) || permutation.length !== n || new Set(permutation).size !== n || permutation.some(i => !Number.isSafeInteger(i) || i < 1 || i > n)) {
      throw Error('The search returned an invalid permutation. Please try again.');
    }
    const seen = new Set(), cycles = [], fixed = [];
    for (let start = 0; start < n; start++) {
      if (seen.has(start)) continue;
      const cycle = [];
      let at = start;
      do { seen.add(at); cycle.push(vertices[at]); at = permutation[at] - 1; } while (at !== start);
      if (cycle.length === 1) fixed.push(cycle[0]);
      else cycles.push('(' + cycle.join(' ') + ')');
    }
    return {notation: 'σ = ' + (cycles.length ? cycles.join('') : 'id'), fixed};
  }
  function reddeningInput(graph) {
    if (graph.adjacency.some((row, i) => row[i] !== 0)) throw Error('Remove loops before searching for a reddening sequence.');
    const indices = graph.vertices.map((id, i) => graph.frozen.includes(id) ? -1 : i).filter(i => i >= 0);
    if (!indices.length) throw Error('Add or unfreeze a node before searching.');
    return {
      vertices: indices.map(i => graph.vertices[i]),
      matrix: indices.map(i => indices.map(j => graph.adjacency[i][j] - graph.adjacency[j][i]))
    };
  }
  function ensurePanel(editor) {
    if (editor.reddeningUI) return editor.reddeningUI;
    if (!document.getElementById('jr-reddening-style')) {
      const style = document.createElement('style');
      style.id = 'jr-reddening-style';
      style.textContent = '#jr-directions .jr-qe-reddening{margin:12px 0;padding:10px 0;border-block:1px solid var(--rule)}#jr-directions .jr-qe-reddening p{margin:0;font-size:11px;color:var(--soft)}#jr-directions .jr-qe-reddening textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;margin:8px 0 0;padding:7px 9px;border:1px solid var(--rule);border-radius:0;background:var(--jr-qe-surface);color:var(--ink);font:12px/1.65 "DM Sans",Arial,sans-serif;overflow-wrap:anywhere}';
      style.textContent += '#jr-directions .jr-qe-reddening .jr-qe-permutation{margin-top:9px;color:var(--ink);overflow-wrap:anywhere}';
      style.textContent += '#jr-directions .jr-qe-playback-buttons{display:flex;flex-wrap:wrap;gap:0 14px}#jr-directions .jr-qe-playback-speed{display:flex;align-items:center;gap:9px;margin:4px 0 8px;font-size:11px;color:var(--soft)}#jr-directions .jr-qe-playback-speed input{min-width:60px;max-width:160px;flex:1;accent-color:var(--accent)}#jr-directions .jr-qe-playback-speed output{min-width:64px;font-variant-numeric:tabular-nums}#jr-directions .jr-qe-editor .jr-qe-node[data-qe-playing="true"] .jr-qe-dot{background:var(--accent);color:var(--paper);border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 24%,transparent),0 0 16px 4px color-mix(in srgb,var(--accent) 50%,transparent);animation:jr-qe-shine 1.4s ease-in-out infinite alternate}@keyframes jr-qe-shine{to{box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 32%,transparent),0 0 21px 5px color-mix(in srgb,var(--accent) 60%,transparent)}}@media(prefers-reduced-motion:reduce){#jr-directions .jr-qe-editor .jr-qe-node[data-qe-playing="true"] .jr-qe-dot{animation:none}}';
      style.textContent += '#jr-directions .jr-qe-playback-slider{display:flex;align-items:center;gap:9px;flex:1;min-width:0}#jr-directions .jr-qe-playback-speed output{white-space:nowrap}#jr-directions [data-qe-playback-max]{flex:none}';
      document.head.append(style);
    }
    const panel = document.createElement('section');
    panel.className = 'jr-qe-reddening';
    panel.setAttribute('data-qe-reddening-panel', '');
    panel.setAttribute('aria-label', 'Reddening search');
    panel.hidden = true;
    const status = document.createElement('p');
    status.setAttribute('data-qe-reddening-status', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const sequence = document.createElement('textarea');
    sequence.setAttribute('data-qe-reddening-sequence', '');
    sequence.setAttribute('aria-label', 'Reddening sequence, using the displayed node numbers');
    sequence.readOnly = true;
    sequence.rows = 3;
    sequence.hidden = true;
    const permutation = document.createElement('p');
    permutation.className = 'jr-qe-permutation';
    permutation.setAttribute('data-qe-reddening-permutation', '');
    permutation.hidden = true;
    const permutationConvention = document.createElement('p');
    permutationConvention.setAttribute('data-qe-permutation-convention', '');
    permutationConvention.textContent = 'Final mutable node → starting node. Each repeat applies σ⁻¹ to the previous sequence.';
    permutationConvention.hidden = true;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'jr-qe-button cursor-interaction';
    copy.setAttribute('data-qe-action', 'copy-reddening');
    copy.textContent = 'Copy sequence';
    copy.hidden = true;
    copy.addEventListener('click', () => copyReddening(editor));
    const playback = document.createElement('div');
    playback.setAttribute('data-qe-playback', '');
    playback.hidden = true;
    const buttons = document.createElement('div');
    buttons.className = 'jr-qe-playback-buttons';
    const makeButton = (name, label, handler) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'jr-qe-button cursor-interaction';
      button.setAttribute('data-qe-playback-' + name, '');
      button.textContent = label; button.addEventListener('click', handler);
      buttons.append(button); return button;
    };
    const play = makeButton('play', 'Play', () => playSequence(editor));
    const step = makeButton('step', 'Step', () => stepSequence(editor));
    const restart = makeButton('restart', 'Restart', () => restartSequence(editor));
    restart.title = 'Restore the original quiver and return to round 1';
    buttons.append(copy);
    const speedRow = document.createElement('div');
    speedRow.className = 'jr-qe-playback-speed';
    const speedLabel = document.createElement('label');
    speedLabel.className = 'jr-qe-playback-slider';
    const speedText = document.createElement('span'); speedText.textContent = 'Speed';
    const speed = document.createElement('input');
    speed.type = 'range'; speed.min = '0.25'; speed.max = '3.25'; speed.step = '0.25'; speed.value = '1';
    speed.setAttribute('data-qe-playback-speed', '');
    speed.setAttribute('aria-label', 'Playback speed; maximum finishes the round at once');
    speed.addEventListener('input', () => setPlaySpeed(editor, Number(speed.value) === 3.25 ? 'max' : Number(speed.value)));
    const speedValue = document.createElement('output');
    const max = document.createElement('button');
    max.type = 'button'; max.className = 'jr-qe-mode cursor-interaction'; max.textContent = 'Max';
    max.setAttribute('data-qe-playback-max', '');
    max.setAttribute('aria-pressed', 'false');
    max.title = 'Finish all remaining mutations at once when playing';
    max.addEventListener('click', () => setPlaySpeed(editor, 'max'));
    const progress = document.createElement('p');
    progress.setAttribute('data-qe-playback-progress', '');
    speedLabel.append(speedText, speed);
    speedRow.append(speedLabel, speedValue, max);
    playback.append(buttons, speedRow, progress);
    panel.append(status, sequence, permutation, permutationConvention, playback);
    editor.root.querySelector('[data-qe-move-help]').after(panel);
    editor.reddeningUI = {panel, status, sequence, permutation, permutationConvention, copy, playback, play, step, restart, speed, speedValue, max, progress};
    // Pause before a drag captures its graph snapshot; a timed mutation must
    // never be overwritten when the user finishes or cancels that drag.
    const pauseForEditing = event => {
      if (event.target.closest?.('[data-qe-node], [data-qe-mode]')) pauseSequence(editor);
    };
    editor.root.addEventListener('pointerdown', pauseForEditing, true);
    editor.root.addEventListener('keydown', pauseForEditing, true);
    editor.root.addEventListener('click', event => {
      if (event.target.closest?.('[data-qe-mode]')) pauseSequence(editor);
    }, true);
    return editor.reddeningUI;
  }
  function syncReddening(editor) {
    ensurePanel(editor);
    const button = editor.root.querySelector('[data-qe-reddening]');
    const busy = !!editor.reddening?.busy;
    let reason = '';
    try { reddeningInput(editor.graph); } catch (error) { reason = error.message; }
    button.textContent = busy ? 'Cancel search' : 'Reddening';
    button.disabled = !busy && !!reason;
    button.title = busy ? 'Stop this search' : reason || 'Search for a reddening sequence on the mutable nodes';
    button.setAttribute('aria-label', button.title);
    syncPlayback(editor);
  }
  function resetReddening(editor, nextGraph) {
    const request = editor.reddening;
    if (request?.applying) { request.signature = quiverSignature(nextGraph); return; }
    if (!request || request.signature === quiverSignature(nextGraph)) return;
    stopPlayback(editor, request, true);
    editor.reddening = null;
    request.cancel?.();
    const ui = ensurePanel(editor);
    ui.panel.hidden = true;
    ui.sequence.value = '';
    ui.sequence.hidden = ui.copy.hidden = true;
    ui.permutation.hidden = ui.permutationConvention.hidden = true;
    ui.permutation.textContent = '';
    ui.playback.hidden = true;
  }
  function isCurrent(editor, request) {
    return editor.reddening === request && request.signature === quiverSignature(editor.graph);
  }
  async function searchReddening(editor) {
    const ui = ensurePanel(editor);
    stopPlayback(editor, editor.reddening, true);
    if (editor.reddening?.busy) {
      const cancelled = editor.reddening;
      editor.reddening = null;
      cancelled.cancel?.();
      ui.status.textContent = 'Search cancelled.';
      ui.panel.hidden = false;
      ui.sequence.hidden = ui.copy.hidden = true;
      ui.permutation.hidden = ui.permutationConvention.hidden = true;
      ui.permutation.textContent = '';
      syncReddening(editor);
      return;
    }
    let input;
    try { input = reddeningInput(editor.graph); }
    catch (error) { ui.panel.hidden = false; ui.status.textContent = error.message; return; }
    const request = {signature: quiverSignature(editor.graph), vertices: input.vertices, busy: true, cancel: null, round: 0, cursor: 0, speed: editor.reddeningSpeed || 1, playing: false, timer: null};
    editor.reddening = request;
    ui.panel.hidden = false;
    ui.sequence.value = '';
    ui.sequence.hidden = ui.copy.hidden = true;
    ui.permutation.hidden = ui.permutationConvention.hidden = true;
    ui.permutation.textContent = '';
    ui.status.textContent = 'Preparing the search… The first use may take a little longer.';
    syncReddening(editor);
    try {
      if (!window.jrDTmu) throw Error('The search could not load. Refresh the homepage and try again.');
      const task = window.jrDTmu.search(input.matrix, {onProgress: progress => {
        if (isCurrent(editor, request) && request.busy) ui.status.textContent = progress.phase === 'searching'
          ? 'Searching for a reddening sequence… You can cancel at any time.'
          : 'Loading the search for its first use…';
      }});
      request.cancel = task.cancel;
      const result = await task.promise;
      if (!isCurrent(editor, request)) return;
      if (result.status === 'dt') {
        if (!Array.isArray(result.sequence) || !result.sequence.length || result.sequence.some(i => !Number.isSafeInteger(i) || i < 1 || i > request.vertices.length)) {
          throw Error('The search returned an invalid sequence. Please try again.');
        }
        const formatted = formatPermutation(request.vertices, result.permutation);
        request.permutation = result.permutation.slice();
        request.sequence = result.sequence.map(i => request.vertices[i - 1]);
        request.baseSequence = request.sequence.slice();
        // permutation[i] is the starting label corresponding to final node i.
        // The next pass must therefore mutate the inverse image of each label.
        request.nextVertex = new Map(request.permutation.map((starting, final) => [request.vertices[starting - 1], request.vertices[final]]));
        request.initialGraph = copyGraph(editor.graph);
        ui.sequence.value = request.sequence.join(', ');
        ui.sequence.rows = Math.min(7, Math.max(2, Math.ceil(ui.sequence.value.length / 36)));
        ui.sequence.hidden = ui.copy.hidden = false;
        ui.permutation.textContent = 'Final relabeling: ' + formatted.notation + (formatted.fixed.length === request.vertices.length ? ' · all mutable nodes fixed' : formatted.fixed.length ? ' · fixed: ' + formatted.fixed.join(', ') : '');
        ui.permutation.hidden = ui.permutationConvention.hidden = false;
        ui.status.textContent = `Found and verified a reddening sequence: ${request.sequence.length} mutation${request.sequence.length === 1 ? '' : 's'}. ` + (editor.graph.frozen.length ? 'Frozen nodes are excluded. ' : '') + 'The quiver is unchanged.';
      } else if (result.status === 'obstruction') {
        ui.status.textContent = 'DTmu verified an obstruction: this mutable quiver has no reddening sequence.';
      } else if (result.status === 'unresolved') {
        ui.status.textContent = 'No sequence found within the search limit. This does not rule out a reddening sequence.';
      } else {
        throw Error('The search could not finish. Please try again.');
      }
    } catch (error) {
      if (isCurrent(editor, request)) ui.status.textContent = error.message || 'The search could not finish. Please try again.';
    } finally {
      if (isCurrent(editor, request)) { request.busy = false; request.cancel = null; syncReddening(editor); }
    }
  }
  function highlightVertex(editor, id = null) {
    for (const node of editor.root.querySelectorAll('[data-qe-node]')) {
      if (Number(node.dataset.qeNode) === id) node.setAttribute('data-qe-playing', 'true');
      else node.removeAttribute('data-qe-playing');
    }
  }
  function syncPlayback(editor) {
    const ui = ensurePanel(editor), request = editor.reddening;
    const available = !!request?.sequence && !request.busy;
    ui.playback.hidden = !available;
    if (!available) return;
    ui.play.textContent = request.playing ? 'Pause' : request.cursor === request.sequence.length ? 'Play again' : 'Play';
    ui.play.title = request.cursor === request.sequence.length ? 'Continue on the current quiver using the permutation-adjusted sequence' : request.playing ? 'Pause this round' : 'Play this round';
    ui.play.setAttribute('aria-pressed', String(request.playing));
    ui.step.disabled = request.playing;
    ui.step.title = request.cursor === request.sequence.length ? 'Begin the next round with one mutation' : 'Apply the next mutation';
    ui.restart.disabled = request.round === 0 && request.cursor === 0;
    ui.sequence.value = request.sequence.join(', ');
    ui.sequence.rows = Math.min(7, Math.max(2, Math.ceil(ui.sequence.value.length / 36)));
    ui.sequence.setAttribute('aria-label', 'Reddening sequence for round ' + (request.round + 1) + ', using the displayed node numbers');
    const maximum = request.speed === 'max';
    ui.speed.value = maximum ? '3.25' : String(request.speed);
    ui.speedValue.textContent = maximum ? 'All at once' : request.speed + ' step' + (request.speed === 1 ? '' : 's') + '/s';
    ui.speed.setAttribute('aria-valuetext', maximum ? 'Max: all remaining mutations at once' : request.speed + ' mutations per second');
    ui.max.setAttribute('aria-pressed', String(maximum));
    ui.progress.textContent = 'Round ' + (request.round + 1) + ' · step ' + request.cursor + ' of ' + request.sequence.length + (request.cursor ? ' · node ' + request.sequence[request.cursor - 1] : '');
  }
  function stopPlayback(editor, request, clearHighlight = false) {
    if (request) { clearTimeout(request.timer); request.timer = null; request.playing = false; }
    if (clearHighlight) highlightVertex(editor);
  }
  function pauseSequence(editor) {
    const request = editor.reddening;
    if (!request?.playing) return;
    stopPlayback(editor, request);
    ensurePanel(editor).status.textContent = 'Playback paused.';
    syncPlayback(editor);
  }
  function scheduleStep(editor, request) {
    clearTimeout(request.timer);
    request.timer = setTimeout(() => {
      request.timer = null;
      if (!isCurrent(editor, request) || !request.playing) return;
      if (document.hidden || editor.root.closest?.('[hidden]')) { pauseSequence(editor); return; }
      if (advanceSequence(editor, request) && request.playing) scheduleStep(editor, request);
    }, 1000 / request.speed);
  }
  function finishRound(editor, request) {
    clearTimeout(request.timer);
    request.timer = null;
    const finish = () => {
      request.instant = true;
      try {
        // Retain exact arithmetic, individual Undo steps, and mutation limits.
        while (request.playing && isCurrent(editor, request) && request.cursor < request.sequence.length) {
          if (!advanceSequence(editor, request)) break;
        }
      } finally { request.instant = false; }
    };
    try {
      if (editor.sequenceActions?.batch) editor.sequenceActions.batch(finish);
      else finish();
    } finally {
      if (request.playing) stopPlayback(editor, request);
      if (isCurrent(editor, request)) {
        highlightVertex(editor, request.cursor ? request.sequence[request.cursor - 1] : null);
        syncPlayback(editor);
      }
    }
  }
  function advanceSequence(editor, request) {
    if (!isCurrent(editor, request) || !request.sequence || request.cursor >= request.sequence.length) return false;
    const id = request.sequence[request.cursor];
    let applied = false;
    request.applying = true;
    try { applied = editor.sequenceActions?.mutate(id) === true; }
    finally { request.applying = false; }
    if (!applied) {
      stopPlayback(editor, request);
      ensurePanel(editor).status.textContent = 'Playback stopped before node ' + id + ': this mutation could not be applied.';
      if (!request.instant) syncPlayback(editor); return false;
    }
    request.signature = quiverSignature(editor.graph);
    request.cursor++;
    if (!request.instant) highlightVertex(editor, id);
    if (request.cursor === request.sequence.length) {
      stopPlayback(editor, request);
      const returned = quiverSignature(editor.graph) === quiverSignature(request.initialGraph);
      ensurePanel(editor).status.textContent = 'Round ' + (request.round + 1) + ' complete: all ' + request.sequence.length + ' mutations applied.'
        + (returned ? ' The starting ' + (editor.graph.frozen.length ? 'ice quiver' : 'quiver') + ' has returned.' : ' Play again continues with the permutation-adjusted sequence.');
    }
    if (!request.instant) syncPlayback(editor); return true;
  }
  function playSequence(editor) {
    const request = editor.reddening;
    if (!request?.sequence || request.busy || !isCurrent(editor, request)) return;
    if (request.playing) { pauseSequence(editor); return; }
    editor.sequenceActions?.finishDrag();
    if (!isCurrent(editor, request)) return;
    if (request.cursor === request.sequence.length) nextRound(request);
    request.playing = true;
    ensurePanel(editor).status.textContent = 'Playing reddening round ' + (request.round + 1) + '.';
    if (request.speed === 'max') finishRound(editor, request);
    else if (advanceSequence(editor, request) && request.playing) scheduleStep(editor, request);
  }
  function stepSequence(editor) {
    const request = editor.reddening;
    if (!request?.sequence || request.busy || !isCurrent(editor, request)) return;
    stopPlayback(editor, request);
    editor.sequenceActions?.finishDrag();
    if (!isCurrent(editor, request)) return;
    if (request.cursor === request.sequence.length) nextRound(request);
    ensurePanel(editor).status.textContent = 'Stepping through reddening round ' + (request.round + 1) + '.';
    advanceSequence(editor, request);
  }
  function nextRound(request) {
    // Keep the entire current ice quiver, including its frozen incidence. Only
    // the word changes: round r uses sigma^(-r) of the original mutation word.
    request.sequence = request.sequence.map(id => request.nextVertex.get(id));
    request.round++;
    request.cursor = 0;
  }
  function restartSequence(editor) {
    const request = editor.reddening;
    if (!request?.initialGraph || !isCurrent(editor, request)) return;
    stopPlayback(editor, request, true);
    editor.sequenceActions?.finishDrag();
    if (!isCurrent(editor, request)) return;
    const initial = copyGraph(request.initialGraph);
    for (const id of initial.vertices) if (editor.graph.positions[id]) initial.positions[id] = editor.graph.positions[id].slice();
    request.applying = true;
    try { editor.sequenceActions?.restore(initial); }
    finally { request.applying = false; }
    request.signature = quiverSignature(editor.graph);
    request.sequence = request.baseSequence.slice();
    request.round = 0;
    request.cursor = 0;
    ensurePanel(editor).status.textContent = 'Restored the starting quiver. Ready for round 1.';
    syncPlayback(editor);
  }
  function setPlaySpeed(editor, value) {
    if (value !== 'max' && !Number.isFinite(value)) return;
    const speed = value === 'max' ? 'max' : Math.round(Math.min(3, Math.max(0.25, value)) * 4) / 4;
    editor.reddeningSpeed = speed;
    const request = editor.reddening;
    if (!request?.sequence) return;
    request.speed = speed;
    if (request.playing) {
      if (speed === 'max') finishRound(editor, request);
      else scheduleStep(editor, request);
    }
    syncPlayback(editor);
  }
  async function copyReddening(editor) {
    if (!editor.reddening?.sequence) return;
    const request = editor.reddening, ui = ensurePanel(editor);
    try {
      await navigator.clipboard.writeText(ui.sequence.value);
      if (isCurrent(editor, request)) ui.status.textContent = 'Reddening sequence copied.';
    } catch {
      if (!isCurrent(editor, request)) return;
      ui.sequence.focus();
      ui.sequence.select();
      ui.status.textContent = 'Sequence selected. Press Ctrl+C or Command+C to copy.';
    }
  }
  window.jrReddening = {search: searchReddening, sync: syncReddening, invalidate: resetReddening, signature: quiverSignature, input: reddeningInput, formatPermutation, play: playSequence, step: stepSequence, restart: restartSequence, speed: setPlaySpeed, pause: pauseSequence};
})();
