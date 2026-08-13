# SP: RepMapeoCuentas2kDoceDetallado
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`scCuenta`](../tables/scCuenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <12/07/2017>
-- Description:	<Mapeo de cuentas delallado 2kDoce>
-- =============================================
CREATE PROCEDURE [RepMapeoCuentas2kDoceDetallado]

	@bHeaderRep BIT = 0,
	@sCo_clasif varchar(6) = null
AS 
    BEGIN
        SET NOCOUNT ON ;
	
 
select m.co_mapeo,m.co_cue_mapeo, m.des_mapeo,c.co_clasif, c.des_clasif, m.co_clasif, m.dep_co_mapeo , CTA.des_cue, R.reng_num, R.co_cue  FROM dbo.scmapeo AS M 

      left JOIN dbo.scren_mapeo AS R 


             ON ((M.co_mapeo = R.co_mapeo)and (M.co_clasif = R.co_clasif) )

      left JOIN dbo.scclasif AS C 

             ON (M.co_clasif = C.co_clasif)			 
      left JOIN dbo.sccuenta AS CTA 

                   ON (R.co_cue = CTA.co_cue)
 
WHERE 
(m.co_clasif = @sCo_clasif or @sCo_clasif is null)
END
```
