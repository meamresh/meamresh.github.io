(() => {
    const mount = document.getElementById('spacetime-bg');
    if (!mount) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const MAX_STARS = 8;
    const EPSILON = 22;
    const CURSOR_MASS_TARGET = 30;

    function attachPointerState(state) {
        const pointerBuffer = { x: 0, y: 0 };

        function mapScreenToFabric(clientX, clientY, out) {
            const x = (clientX / viewportWidth - 0.5) * state.fabricWidth;
            const y = ((1 - clientY / viewportHeight) - 0.5) * state.fabricHeight;
            out.x = Math.max(-state.fabricHalfWidth + 1.4, Math.min(state.fabricHalfWidth - 1.4, x));
            out.y = Math.max(-state.fabricHalfHeight + 1.4, Math.min(state.fabricHalfHeight - 1.4, y));
            return true;
        }

        state._mapScreenToFabric = mapScreenToFabric;

        window.addEventListener('pointermove', (event) => {
            if (mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
                state.cursorMass.target.x = pointerBuffer.x;
                state.cursorMass.target.y = pointerBuffer.y;
                state.cursorMass.targetStrength = CURSOR_MASS_TARGET;
            }
        }, { passive: true });

        window.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            if (!mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
                return;
            }

            const strength = 18 + Math.random() * 12;
            state.persistentMasses.push({
                position: { x: pointerBuffer.x, y: pointerBuffer.y },
                strength,
                currentStrength: 0,
                targetStrength: strength,
                phase: Math.random() * Math.PI * 2
            });

            if (state.persistentMasses.length > MAX_STARS) {
                state.persistentMasses.shift();
            }
        }, { passive: true });

        const releaseCursorMass = () => {
            state.cursorMass.targetStrength = 0;
        };

        window.addEventListener('blur', releaseCursorMass);
        document.addEventListener('mouseleave', releaseCursorMass);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                releaseCursorMass();
            }
        });
    }

    function initCanvasFallback() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        mount.appendChild(canvas);
        mount.setAttribute('data-mode', 'fallback');

        const fabricWidth = 182;
        const fabricHeight = 124;
        const fabricHalfWidth = fabricWidth * 0.5;
        const fabricHalfHeight = fabricHeight * 0.5;

        const gridX = viewportWidth < 900 ? 72 : 96;
        const gridY = viewportWidth < 900 ? 42 : 56;
        const gridVertices = [];

        for (let iy = 0; iy <= gridY; iy += 1) {
            for (let ix = 0; ix <= gridX; ix += 1) {
                const x = (ix / gridX - 0.5) * fabricWidth;
                const y = (iy / gridY - 0.5) * fabricHeight;
                gridVertices.push({ x, y, z: 0 });
            }
        }

        const state = {
            fabricWidth,
            fabricHeight,
            fabricHalfWidth,
            fabricHalfHeight,
            persistentMasses: [],
            cursorMass: {
                position: { x: 0, y: 0 },
                target: { x: 0, y: 0 },
                strength: 0,
                targetStrength: 0,
                phase: Math.random() * Math.PI * 2
            }
        };

        attachPointerState(state);

        const stars = [];
        const starCount = viewportWidth < 900 ? 130 : 200;
        for (let i = 0; i < starCount; i += 1) {
            stars.push({
                x: (Math.random() - 0.5) * fabricWidth * 1.35,
                y: (Math.random() - 0.5) * fabricHeight * 1.35,
                z: 18 + Math.random() * 24,
                p: Math.random() * Math.PI * 2
            });
        }

        function mapToScreen(x, y, z) {
            const depth = 1 / (1 + (58 - y) * 0.012);
            const sx = viewportWidth * 0.5 + x * depth * (viewportWidth / 220);
            const sy = viewportHeight * 0.5 - (y * 0.58 + z * 1.6) * depth * (viewportHeight / 180);
            return { sx, sy, depth };
        }

        function applyMass(sampleX, sampleY, massX, massY, strength) {
            const dx = sampleX - massX;
            const dy = sampleY - massY;
            return -strength / Math.sqrt(dx * dx + dy * dy + EPSILON);
        }

        function drawRing(x, y, strength, t, isCursor) {
            const radius = Math.max(8, Math.sqrt(strength + 0.2) * (isCursor ? 7.4 : 6.8));
            const pulse = 1 + Math.sin(t * 0.0013 + strength) * 0.04;

            ctx.beginPath();
            ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = isCursor ? 'rgba(163, 197, 255, 0.36)' : 'rgba(189, 214, 255, 0.42)';
            ctx.lineWidth = 1.05;
            ctx.shadowBlur = 14;
            ctx.shadowColor = 'rgba(140, 184, 255, 0.58)';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, Math.max(2, radius * 0.22), 0, Math.PI * 2);
            ctx.fillStyle = isCursor ? 'rgba(216, 233, 255, 0.38)' : 'rgba(236, 245, 255, 0.45)';
            ctx.fill();

            ctx.shadowBlur = 0;
        }

        function renderFallback(time) {
            requestAnimationFrame(renderFallback);

            if (prefersReducedMotion && (time % 34) > 16) {
                return;
            }

            canvas.width = viewportWidth;
            canvas.height = viewportHeight;

            ctx.clearRect(0, 0, viewportWidth, viewportHeight);

            state.cursorMass.position.x += (state.cursorMass.target.x - state.cursorMass.position.x) * 0.16;
            state.cursorMass.position.y += (state.cursorMass.target.y - state.cursorMass.position.y) * 0.16;
            state.cursorMass.strength += (state.cursorMass.targetStrength - state.cursorMass.strength) * 0.085;

            for (let i = 0; i < state.persistentMasses.length; i += 1) {
                const mass = state.persistentMasses[i];
                mass.currentStrength += (mass.targetStrength - mass.currentStrength) * 0.08;
            }

            for (let i = 0; i < gridVertices.length; i += 1) {
                const v = gridVertices[i];
                let zTarget = 0;

                for (let m = 0; m < state.persistentMasses.length; m += 1) {
                    const mass = state.persistentMasses[m];
                    zTarget += applyMass(v.x, v.y, mass.position.x, mass.position.y, mass.currentStrength);
                }

                zTarget += applyMass(v.x, v.y, state.cursorMass.position.x, state.cursorMass.position.y, state.cursorMass.strength);
                v.z += (zTarget - v.z) * 0.12;
            }

            ctx.strokeStyle = 'rgba(140, 181, 255, 0.44)';
            ctx.lineWidth = 0.72;

            for (let iy = 0; iy <= gridY; iy += 1) {
                ctx.beginPath();
                for (let ix = 0; ix <= gridX; ix += 1) {
                    const v = gridVertices[iy * (gridX + 1) + ix];
                    const p = mapToScreen(v.x, v.y, v.z);
                    if (ix === 0) {
                        ctx.moveTo(p.sx, p.sy);
                    } else {
                        ctx.lineTo(p.sx, p.sy);
                    }
                }
                ctx.stroke();
            }

            for (let ix = 0; ix <= gridX; ix += 2) {
                ctx.beginPath();
                for (let iy = 0; iy <= gridY; iy += 1) {
                    const v = gridVertices[iy * (gridX + 1) + ix];
                    const p = mapToScreen(v.x, v.y, v.z);
                    if (iy === 0) {
                        ctx.moveTo(p.sx, p.sy);
                    } else {
                        ctx.lineTo(p.sx, p.sy);
                    }
                }
                ctx.stroke();
            }

            for (let i = 0; i < stars.length; i += 1) {
                const star = stars[i];
                let sx = star.x;
                let sy = star.y;

                const allMasses = state.persistentMasses.slice();
                allMasses.push({ position: state.cursorMass.position, currentStrength: state.cursorMass.strength });

                for (let m = 0; m < allMasses.length; m += 1) {
                    const mass = allMasses[m];
                    const dx = sx - mass.position.x;
                    const dy = sy - mass.position.y;
                    const r2 = dx * dx + dy * dy + 48;
                    const r = Math.sqrt(r2);
                    const radialShift = (34 * mass.currentStrength) / (r2 * (r + 1));
                    const shearShift = (mass.currentStrength / (r2 + 120)) * 0.022;
                    sx += -dx * radialShift - dy * shearShift;
                    sy += -dy * radialShift + dx * shearShift;
                }

                const p = mapToScreen(sx, sy, star.z + Math.sin(time * 0.001 + star.p) * 0.12);
                const radius = 0.72 + p.depth * 0.8;

                ctx.beginPath();
                ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(223, 237, 255, 0.62)';
                ctx.fill();
            }

            for (let i = 0; i < state.persistentMasses.length; i += 1) {
                const mass = state.persistentMasses[i];
                const p = mapToScreen(mass.position.x, mass.position.y, -2);
                drawRing(p.sx, p.sy, mass.currentStrength, time, false);
            }

            const cursorPoint = mapToScreen(state.cursorMass.position.x, state.cursorMass.position.y, -2);
            drawRing(cursorPoint.sx, cursorPoint.sy, state.cursorMass.strength, time, true);
        }

        function handleResizeFallback() {
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;
        }

        window.addEventListener('resize', handleResizeFallback, { passive: true });

        renderFallback(0);
    }

    function initWebGL() {
        const THREE = window.THREE;
        if (!THREE) {
            initCanvasFallback();
            return;
        }

        const FABRIC_WIDTH = 182;
        const FABRIC_HEIGHT = 124;
        const FABRIC_HALF_WIDTH = FABRIC_WIDTH * 0.5;
        const FABRIC_HALF_HEIGHT = FABRIC_HEIGHT * 0.5;
        const SEGMENTS_X = viewportWidth < 900 ? 86 : 118;
        const SEGMENTS_Y = viewportWidth < 900 ? 58 : 82;

        const RECOVERY_RATE = 0.12;
        const LENSING_STRENGTH = viewportWidth < 900 ? 24 : 34;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(48, viewportWidth / viewportHeight, 0.1, 500);
        camera.position.set(0, -58, 58);
        camera.lookAt(0, 0, -2);

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            initCanvasFallback();
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setSize(viewportWidth, viewportHeight);
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);
        mount.setAttribute('data-mode', 'webgl');

        const fabricGeometry = new THREE.PlaneGeometry(FABRIC_WIDTH, FABRIC_HEIGHT, SEGMENTS_X, SEGMENTS_Y);
        const vertexCount = fabricGeometry.attributes.position.count;
        const fabricPositions = fabricGeometry.attributes.position.array;
        const fabricBasePositions = new Float32Array(fabricPositions.length);
        fabricBasePositions.set(fabricPositions);

        const displacementCurrent = new Float32Array(vertexCount);

        const fabricFill = new THREE.Mesh(
            fabricGeometry,
            new THREE.MeshBasicMaterial({
                color: 0x112744,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );

        const fabricWire = new THREE.Mesh(
            fabricGeometry,
            new THREE.MeshBasicMaterial({
                color: 0x9fc4ff,
                wireframe: true,
                transparent: true,
                opacity: 0.8,
                depthWrite: false
            })
        );

        fabricFill.position.z = -0.4;
        fabricWire.position.z = -0.35;

        scene.add(fabricFill, fabricWire);

        const raycaster = new THREE.Raycaster();
        const pointerNDC = new THREE.Vector2();
        const hitPoint = new THREE.Vector3();
        const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        function mapScreenToFabric(clientX, clientY, out) {
            pointerNDC.set((clientX / viewportWidth) * 2 - 1, -(clientY / viewportHeight) * 2 + 1);
            raycaster.setFromCamera(pointerNDC, camera);

            if (!raycaster.ray.intersectPlane(interactionPlane, hitPoint)) {
                return false;
            }

            out.set(
                THREE.MathUtils.clamp(hitPoint.x, -FABRIC_HALF_WIDTH + 1.4, FABRIC_HALF_WIDTH - 1.4),
                THREE.MathUtils.clamp(hitPoint.y, -FABRIC_HALF_HEIGHT + 1.4, FABRIC_HALF_HEIGHT - 1.4)
            );

            return true;
        }

        function createGlowTexture() {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.25, 'rgba(196,224,255,0.92)');
            gradient.addColorStop(0.6, 'rgba(120,170,255,0.35)');
            gradient.addColorStop(1, 'rgba(120,170,255,0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            const texture = new THREE.CanvasTexture(canvas);
            return texture;
        }

        const glowTexture = createGlowTexture();

        function createMassRing(color) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(1.5, 1.72, 72),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.22,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            ring.position.z = 0.8;
            scene.add(ring);
            return ring;
        }

        function createMassCore(color) {
            const core = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: glowTexture,
                    color,
                    transparent: true,
                    opacity: 0.5,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            core.position.z = 1.4;
            core.scale.set(1.2, 1.2, 1);
            scene.add(core);
            return core;
        }

        const persistentMasses = [];

        const cursorMass = {
            position: new THREE.Vector2(0, 0),
            target: new THREE.Vector2(0, 0),
            strength: 0,
            targetStrength: 0,
            phase: Math.random() * Math.PI * 2,
            ring: createMassRing(0x95c0ff),
            core: createMassCore(0xcfe4ff)
        };

        cursorMass.ring.material.opacity = 0.14;
        cursorMass.core.material.opacity = 0.0;

        function disposeMassVisuals(mass) {
            scene.remove(mass.ring, mass.core);
            mass.ring.geometry.dispose();
            mass.ring.material.dispose();
            mass.core.material.dispose();
        }

        function addPersistentMass(x, y) {
            const strength = THREE.MathUtils.randFloat(18, 30);
            const mass = {
                position: new THREE.Vector2(x, y),
                strength,
                currentStrength: 0,
                targetStrength: strength,
                phase: Math.random() * Math.PI * 2,
                ring: createMassRing(0xaec7ff),
                core: createMassCore(0xf5f9ff)
            };

            persistentMasses.push(mass);

            if (persistentMasses.length > MAX_STARS) {
                const oldest = persistentMasses.shift();
                disposeMassVisuals(oldest);
            }
        }

        function releaseCursorMass() {
            cursorMass.targetStrength = 0;
        }

        const pointerBuffer = new THREE.Vector2();

        window.addEventListener('pointermove', (event) => {
            if (mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
                cursorMass.target.copy(pointerBuffer);
                cursorMass.targetStrength = CURSOR_MASS_TARGET;
            }
        }, { passive: true });

        window.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            if (!mapScreenToFabric(event.clientX, event.clientY, pointerBuffer)) {
                return;
            }

            addPersistentMass(pointerBuffer.x, pointerBuffer.y);
        }, { passive: true });

        window.addEventListener('blur', releaseCursorMass);
        document.addEventListener('mouseleave', releaseCursorMass);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                releaseCursorMass();
            }
        });

        const backgroundStarCount = viewportWidth < 900 ? 170 : 280;
        const starBasePositions = new Float32Array(backgroundStarCount * 3);
        const starPositions = new Float32Array(backgroundStarCount * 3);
        const starPhase = new Float32Array(backgroundStarCount);

        for (let i = 0; i < backgroundStarCount; i += 1) {
            const i3 = i * 3;
            const x = THREE.MathUtils.randFloatSpread(FABRIC_WIDTH * 1.35);
            const y = THREE.MathUtils.randFloatSpread(FABRIC_HEIGHT * 1.35);
            const z = THREE.MathUtils.randFloat(18, 42);

            starBasePositions[i3] = x;
            starBasePositions[i3 + 1] = y;
            starBasePositions[i3 + 2] = z;

            starPositions[i3] = x;
            starPositions[i3 + 1] = y;
            starPositions[i3 + 2] = z;

            starPhase[i] = Math.random() * Math.PI * 2;
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

        const starMaterial = new THREE.PointsMaterial({
            color: 0xd4e3ff,
            size: viewportWidth < 900 ? 0.75 : 0.95,
            transparent: true,
            opacity: 0.68,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const starField = new THREE.Points(starGeometry, starMaterial);
        scene.add(starField);

        function applyMassContribution(sampleX, sampleY, massX, massY, strength) {
            const dx = sampleX - massX;
            const dy = sampleY - massY;
            return -strength / Math.sqrt(dx * dx + dy * dy + EPSILON);
        }

        function applyLensing(sampleX, sampleY, massX, massY, strength, out) {
            const dx = sampleX - massX;
            const dy = sampleY - massY;
            const r2 = dx * dx + dy * dy + 48;
            const r = Math.sqrt(r2);

            const radialShift = (LENSING_STRENGTH * strength) / (r2 * (r + 1));
            const shearShift = (strength / (r2 + 120)) * 0.025;

            out.x += -dx * radialShift - dy * shearShift;
            out.y += -dy * radialShift + dx * shearShift;
        }

        function updateMassVisual(mass, strength, time, isCursor) {
            const safeStrength = Math.max(strength, 0);
            const schwarzschildRadius = Math.max(1.05, 0.9 * Math.sqrt(safeStrength + 0.2));
            const twinkle = 1 + Math.sin(time * 0.0012 + mass.phase) * 0.05;

            mass.ring.position.set(mass.position.x, mass.position.y, 0.82);
            mass.ring.scale.set(schwarzschildRadius, schwarzschildRadius, 1);
            mass.ring.material.opacity = isCursor
                ? 0.08 + Math.min(0.18, safeStrength * 0.006)
                : 0.13 + Math.min(0.24, safeStrength * 0.005);

            const coreScale = (isCursor ? 1.18 : 1.0) + Math.sqrt(safeStrength + 0.01) * 0.08;
            mass.core.position.set(mass.position.x, mass.position.y, 1.4);
            mass.core.scale.set(coreScale * twinkle, coreScale * twinkle, 1);
            mass.core.material.opacity = Math.min(isCursor ? 0.48 : 0.68, safeStrength * 0.024);
        }

        const lensingVector = new THREE.Vector2();
        let lastFrameTime = 0;

        function animate(time) {
            requestAnimationFrame(animate);

            if (prefersReducedMotion && time - lastFrameTime < 34) {
                return;
            }

            lastFrameTime = time;

            cursorMass.position.lerp(cursorMass.target, 0.16);
            cursorMass.strength += (cursorMass.targetStrength - cursorMass.strength) * 0.085;

            for (let i = 0; i < persistentMasses.length; i += 1) {
                const mass = persistentMasses[i];
                mass.currentStrength += (mass.targetStrength - mass.currentStrength) * 0.08;
                updateMassVisual(mass, mass.currentStrength, time, false);
            }

            updateMassVisual(cursorMass, cursorMass.strength, time, true);

            for (let i = 0; i < vertexCount; i += 1) {
                const i3 = i * 3;
                const px = fabricBasePositions[i3];
                const py = fabricBasePositions[i3 + 1];

                let zTarget = 0;

                for (let m = 0; m < persistentMasses.length; m += 1) {
                    const mass = persistentMasses[m];
                    if (mass.currentStrength > 0.02) {
                        zTarget += applyMassContribution(px, py, mass.position.x, mass.position.y, mass.currentStrength);
                    }
                }

                if (cursorMass.strength > 0.02) {
                    zTarget += applyMassContribution(px, py, cursorMass.position.x, cursorMass.position.y, cursorMass.strength);
                }

                displacementCurrent[i] += (zTarget - displacementCurrent[i]) * RECOVERY_RATE;
                fabricPositions[i3 + 2] = fabricBasePositions[i3 + 2] + displacementCurrent[i];
            }

            fabricGeometry.attributes.position.needsUpdate = true;

            for (let i = 0; i < backgroundStarCount; i += 1) {
                const i3 = i * 3;
                const baseX = starBasePositions[i3];
                const baseY = starBasePositions[i3 + 1];
                const baseZ = starBasePositions[i3 + 2];

                lensingVector.set(0, 0);

                for (let m = 0; m < persistentMasses.length; m += 1) {
                    const mass = persistentMasses[m];
                    if (mass.currentStrength > 0.03) {
                        applyLensing(baseX, baseY, mass.position.x, mass.position.y, mass.currentStrength, lensingVector);
                    }
                }

                if (cursorMass.strength > 0.03) {
                    applyLensing(baseX, baseY, cursorMass.position.x, cursorMass.position.y, cursorMass.strength, lensingVector);
                }

                starPositions[i3] += (baseX + lensingVector.x - starPositions[i3]) * 0.16;
                starPositions[i3 + 1] += (baseY + lensingVector.y - starPositions[i3 + 1]) * 0.16;
                starPositions[i3 + 2] = baseZ + Math.sin(time * 0.001 + starPhase[i]) * 0.12;
            }

            starGeometry.attributes.position.needsUpdate = true;
            starMaterial.opacity = 0.62 + 0.06 * Math.sin(time * 0.0008);

            renderer.render(scene, camera);
        }

        function handleResize() {
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;

            camera.aspect = viewportWidth / viewportHeight;
            camera.updateProjectionMatrix();

            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
            renderer.setSize(viewportWidth, viewportHeight);
        }

        window.addEventListener('resize', handleResize, { passive: true });

        animate(0);
    }

    initWebGL();
})();
