import { BaseController, TemplateHelpers } from './base_controller';
import { DeskService } from '../modules/system/desk_service';
import express from 'express';

export class DesksController extends BaseController {
  constructor(templateHelpers: TemplateHelpers, private deskService: DeskService) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    // Desk management UI
    router.get('/desk', (req: any, res: any) => {
      const deskList = this.deskService.getDesks();
      res.render('desk/index', {
        activePage: 'desk',
        title: 'Desk Settings | Crypto Bot',
        deskList,
        success: req.query.success,
        error: req.query.error
      });
    });

    router.get('/desk/new', (req: any, res: any) => {
      res.render('desk/form', {
        activePage: 'desk',
        title: 'Create Desk | Crypto Bot',
        isNew: true,
        desk: {
          name: '',
          grid: 4,
          intervals: [15, 60, 1440],
          height: 400,
          pairs: []
        }
      });
    });

    router.get('/desk/:id/edit', (req: any, res: any) => {
      const desks = this.deskService.getDesks();
      const id = parseInt(req.params.id, 10);

      if (isNaN(id) || id < 0 || id >= desks.length) {
        return res.redirect('/desk?error=' + encodeURIComponent('Desk not found'));
      }

      res.render('desk/form', {
        activePage: 'desk',
        title: `Edit Desk: ${desks[id].name} | Crypto Bot`,
        isNew: false,
        deskId: id,
        desk: desks[id]
      });
    });

    router.post('/desk', (req: any, res: any) => {
      try {
        const desks = this.deskService.getDesks();
        const newDesk = this.parseDeskForm(req.body);

        if (!newDesk.name || newDesk.name.trim() === '') {
          return res.render('desk/form', {
            activePage: 'desk',
            title: 'Create Desk | Crypto Bot',
            isNew: true,
            desk: { ...newDesk, name: req.body.name },
            error: 'Desk name is required'
          });
        }

        desks.push(newDesk);
        this.deskService.saveDesks(desks);
        res.redirect('/desk');
      } catch (e) {
        console.error('Error creating desk:', e);
        res.redirect('/desk');
      }
    });

    router.post('/desk/:id', (req: any, res: any) => {
      try {
        const desks = this.deskService.getDesks();
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id < 0 || id >= desks.length) {
          return res.redirect('/desk');
        }

        const updatedDesk = this.parseDeskForm(req.body);

        if (!updatedDesk.name || updatedDesk.name.trim() === '') {
          return res.render('desk/form', {
            activePage: 'desk',
            title: `Edit Desk | Crypto Bot`,
            isNew: false,
            deskId: id,
            desk: { ...updatedDesk, name: req.body.name },
            error: 'Desk name is required'
          });
        }

        desks[id] = updatedDesk;
        this.deskService.saveDesks(desks);
        res.redirect('/desk');
      } catch (e) {
        console.error('Error updating desk:', e);
        res.redirect('/desk');
      }
    });

    router.post('/desk/:id/delete', (req: any, res: any) => {
      try {
        const desks = this.deskService.getDesks();
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id < 0 || id >= desks.length) {
          return res.redirect('/desk');
        }

        desks.splice(id, 1);
        this.deskService.saveDesks(desks);
        res.redirect('/desk');
      } catch (e) {
        console.error('Error deleting desk:', e);
        res.redirect('/desk');
      }
    });

    // Desk view
    router.get('/desks/:desk', async (req: any, res: any) => {
      const desks = this.deskService.getDesks();
      res.render('desks', {
        activePage: 'desks',
        title: `Desk: ${desks[req.params.desk].name} | Crypto Bot`,
        desk: desks[req.params.desk],
        interval: req.query.interval || undefined,
        id: req.params.desk
      });
    });

    // Desk fullscreen view
    router.get('/desks/:desk/fullscreen', (req: any, res: any) => {
      const desks = this.deskService.getDesks();
      const configElement = desks[req.params.desk];
      res.render('tradingview_desk', {
        layout: false,
        desk: configElement,
        interval: req.query.interval || undefined,
        id: req.params.desk,
        watchlist: configElement.pairs.map((i: any) => i.symbol),
        desks: desks.map((d: any) => d.name)
      });
    });
  }

  private parseDeskForm(body: any): any {
    // Parse intervals from form data (can be array or single value)
    let intervals: number[] = [15, 60, 1440];
    if (body.intervals) {
      if (Array.isArray(body.intervals)) {
        intervals = body.intervals
          .map((s: string) => parseInt(s, 10))
          .filter((n: number) => !isNaN(n) && n > 0);
      } else if (typeof body.intervals === 'string') {
        intervals = [parseInt(body.intervals, 10)].filter((n: number) => !isNaN(n) && n > 0);
      }
    }

    // Parse pairs from form data
    const pairs: { symbol: string }[] = [];
    if (body.pairs) {
      if (Array.isArray(body.pairs)) {
        for (const pair of body.pairs) {
          if (pair.symbol && pair.symbol.trim()) {
            pairs.push({ symbol: pair.symbol.trim() });
          }
        }
      } else if (typeof body.pairs === 'object') {
        for (const key of Object.keys(body.pairs)) {
          const pair = body.pairs[key];
          if (pair.symbol && pair.symbol.trim()) {
            pairs.push({ symbol: pair.symbol.trim() });
          }
        }
      }
    }

    return {
      name: (body.name || '').trim(),
      grid: parseInt(body.grid, 10) || 4,
      intervals,
      height: parseInt(body.height, 10) || 400,
      pairs
    };
  }
}
