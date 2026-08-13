# SP: pSeleccionarRenglonesDepositoBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarRenglonesDepositoBanco
DESCRIPCION	: Selecciona un registro de la tabla saDepositoBancoReng
CREADO POR	: SOFTECH SISTEMAS
FECHA CREADO: <2011-12-12>
FECHA MODIFICADO: <2019-09-30>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesDepositoBanco] ( @sDep_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            c.descrip, db.dep_num, db.reng_num, db.codigo, db.mov_afec_c, db.mov_gene_c, mc.forma_pag, mc.fecha,
            mc.num_pago AS doc_num, mc.descrip Descripcion, db.monto, mc.origen, --mc.cob_pag, 
            mc.co_tar AS co_tarj, mc.co_ban banc_tarj, db.porc_comision AS comision, db.porc_impuesto AS impuesto, c.co_mone AS moneda, db.tipo_plazo,
            mc.aux01, mc.aux02, db.co_sucu_in, db.co_us_in, db.fe_us_in, db.co_sucu_mo, db.co_us_mo, db.fe_us_mo,
            db.revisado, db.trasnfe, db.comision AS valorcomision, db.impuesto AS valorimpuesto
        FROM
            saDepositoBancoReng db
            INNER JOIN saCaja c ON db.Codigo = c.cod_caja
            INNER JOIN saMovimientoCaja mc ON mc.mov_num = db.mov_afec_c
            /*LEFT JOIN saTarjetaCredito TC ON TC.co_tar = mc.co_tar */
        WHERE
            db.dep_num = @sDep_Num
        ORDER BY
            reng_num ASC
	
    END
```
