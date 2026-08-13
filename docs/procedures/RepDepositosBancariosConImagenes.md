# SP: RepDepositosBancariosConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- ======================================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16/01/2015>
-- Description:	<Reporte (Resumen) de Depósitos Bancarios Con Imagenes>
-- ======================================================
CREATE PROCEDURE [dbo].[RepDepositosBancariosConImagenes]
	-- Add the parameters for the stored procedure here
    @d_Fecha_d SMALLDATETIME = NULL ,
    @d_Fecha_h SMALLDATETIME = NULL ,
	@sNumDep_d CHAR (20) = NULL ,
	@sNumDep_h CHAR (20) = NULL ,
	@sNumPlanilla_d CHAR (10) = NULL ,
	@sNumPlanilla_h CHAR (10) = NULL ,
	
	@sCtaBan_d CHAR (6) = NULL ,
	@sCtaBan_h CHAR (6) = NULL ,
	@sCtaIng_d CHAR (20) = NULL ,
	@sCtaIng_h CHAR (20) = NULL ,
	
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
	@sSucursal CHAR (6) = NULL ,
	@sMoneda CHAR (6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

    	SET @d_Fecha_d = dbo.FechaSimple(@d_Fecha_d)
    	SET @d_Fecha_h = dbo.FechaSimple(@d_Fecha_h)    	

		SELECT
			DB.dep_num, DB.fecha, DB.deposito as planilla, DB.total_efec as total_efec,	CB.cod_cta, CB.num_cta, CB.co_mone, 
			BA.des_ban,	DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, 
				( select SUM(monto_h)
					from saDepositoBanco AS DB1 
					left join saDepositoBancoReng as BR1 ON DB1.dep_num = BR1.dep_num
					left join saMovimientoCaja as MC1 on BR1.mov_afec_c = MC1.mov_num 
					WHERE (DB1.dep_num = DB.dep_num) and (MC1.forma_pag = 'CH'))  AS SumaCH,
				( select SUM(monto_h)
					from saDepositoBanco AS DB1 
					left join saDepositoBancoReng as BR1 ON DB1.dep_num = BR1.dep_num
					left join saMovimientoCaja as MC1 on BR1.mov_afec_c = MC1.mov_num 
					WHERE (DB1.dep_num = DB.dep_num) and (MC1.forma_pag = 'TJ'))  AS SumaTJ,
				( select SUM(monto_h)
					from saDepositoBanco AS DB1 
					left join saDepositoBancoReng as BR1 ON DB1.dep_num = BR1.dep_num
					left join saMovimientoCaja as MC1 on BR1.mov_afec_c = MC1.mov_num 
					WHERE (DB1.dep_num = DB.dep_num) and (MC1.forma_pag = 'CT'))  AS SumaCT,
				( select SUM(comision)
					from saDepositoBanco AS DB1 
					left join saDepositoBancoReng as BR1 ON DB1.dep_num = BR1.dep_num
					left join saMovimientoCaja as MC1 on BR1.mov_afec_c = MC1.mov_num 
					WHERE (DB1.dep_num = DB.dep_num) and (MC1.forma_pag = 'TJ'))  AS SumaCOM,
				( select SUM(impuesto)
					fro
```
