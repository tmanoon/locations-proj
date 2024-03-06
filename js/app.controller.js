import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'
export let gUserPos = {
    lat: null,
    lng: null
}
window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
}

function onInit() {
    loadAndRenderLocs()

    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}
// const sampleLoc = {
//     id: 'GEouN',
//     name: 'Dahab, Egypt',
//     rate: 5,
//     geo: {
//         address: 'Dahab, South Sinai, Egypt',
//         lat: 28.5096676,
//         lng: 34.5165187,
//         zoom: 11
//     },
//     createdAt: 1706562160181,
//     updatedAt: 1706562160181
// }
function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span class="pacifico">${loc.name}</span>
                <span class="distance pacifico">Distance: ${utilService.getDistance({ lat: loc.geo.lat, lng: loc.geo.lng }, { lat: gUserPos.lat, lng: gUserPos.lng }, 'K')} KM.</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted pacifico">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')"><div><i class="fa-regular fa-trash-can"></i></div></button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')"><div><i class="fa-solid fa-pencil"></i></div></button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')"><div><i class="fa-solid fa-map-location-dot"></i></div></button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    const confirmation = Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
    })
        .then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: "Deleted!",
                    text: "Your file has been deleted.",
                    icon: "success"
                })
                    .then(locService.remove(locId))
            } else return Promise.reject('Deletion canceled')
        })
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Location not removed')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    displayModal('add')
        .then(({ name, rate }) => {
            const loc = {
                name,
                rate,
                geo
            }
            return locService.save(loc)
        })
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            displayModal('update', loc)
                .then(({ name, rate }) => {
                    loc.name = name
                    loc.rate = rate
                    return locService.save(loc)
                })
                .then(savedLoc => {
                    flashMsg(`Location updated (id: ${savedLoc.id})`)
                    loadAndRenderLocs()
                })
                .catch(err => {
                    console.error('OOPs:', err)
                    flashMsg('Cannot update location')
                })
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const elSelected = document.querySelector('.selected-loc')
    elSelected.querySelector('.loc-name').innerText = loc.name
    elSelected.querySelector('.loc-address').innerText = loc.geo.address
    elSelected.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    elSelected.querySelector('[name=loc-copier]').value = window.location
    elSelected.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdateMap().then(stats => {
        handleStats(stats, 'loc-stats-updates')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function displayModal(addOrUpdated, loc = null) {
    return new Promise((resolve, reject) => {
        const elModal = document.getElementById('locationDialog')
        const elHeader = elModal.querySelector('#dialogTitle')
        const elNameInput = elModal.querySelector('#locationName')
        const elRateInput = elModal.querySelector('#locationRate')

        if (addOrUpdated === 'add') {
            elHeader.innerText = 'Add the new location name, please.'
        } else if (addOrUpdated === 'update' && loc) {
            elHeader.innerText = 'Update the location'
            elNameInput.value = loc.name
            elRateInput.value = loc.rate
        }

        elModal.showModal()
        elModal.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault()

            const name = elNameInput.value
            const rate = parseInt(elRateInput.value)

            if (!name || !rate) {
                reject('Please fill in all fields.')
                return
            }
            resolve({ name, rate })
            elModal.close()
        })

        elModal.querySelector('button[type="button"]').addEventListener('click', () => {
            reject('Modal closed without saving.')
            elModal.close()
        })
    })
}
