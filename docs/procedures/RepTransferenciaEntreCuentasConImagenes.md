# SP: RepTransferenciaEntreCuentasConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-06-2015>
-- Description:	<Transferencia entre Cuentas con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepTransferenciaEntreCuentasConImagenes]
    @sCo_Trans_Ban_d CHAR(20) = NULL,
    @sCo_Trans_Ban_h CHAR(20) = NULL,
    @sCta_Origen_d CHAR(6) = NULL,
	@sCta_Origen_h CHAR(6) = NULL,
	@sCta_Destino_d CHAR(6) = NULL,
    @sCta_Destino_h CHAR(6) = NULL,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@dFecha_Ori_d SMALLDATETIME = NULL,
    @dFecha_Ori_h SMALLDATETIME = NULL,
	@dFecha_Dest_d SMALLDATETIME = NULL,
    @dFecha_Dest_h SMALLDATETIME = NULL,
    @sCta_IngrEgr_Ori_d CHAR(20) = NULL,
    @sCta_IngrEgr_Ori_h CHAR(20) = NULL,
    @sCta_IngrEgr_Dest_d CHAR(20) = NULL,
    @sCta_IngrEgr_Dest_h CHAR(20) = NULL,
    @sCo_Tipo_Imag CHAR(6) = NULL,    
    @sProcesado CHAR(4) = NULL,        
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0	
AS 
    BEGIN
        SET NOCOUNT ON ;       
	
		IF @dFecha_d IS NOT NULL
			set @dFecha_d = dbo.FechaSimple(@dFecha_d)  
		IF @dFecha_h IS NOT NULL
			set @dFecha_h = dbo.FechaSimple(@dFecha_h)

		IF @dFecha_Ori_d IS NOT NULL
			set @dFecha_Ori_d = dbo.FechaSimple(@dFecha_Ori_d)  
		IF @dFecha_Ori_h IS NOT NULL
			set @dFecha_Ori_h = dbo.FechaSimple(@dFecha_Ori_h)

		IF @dFecha_Dest_d IS NOT NULL
			set @dFecha_Dest_d = dbo.FechaSimple(@dFecha_Dest_d)  
		IF @dFecha_Dest_h IS NOT NULL
			set @dFecha_Dest_h = dbo.FechaSimple(@dFecha_Dest_h)

        SELECT  TEC.co_trans_ban, TEC.des_trans_ban, TEC.fecha, TEC.procesado, TEC.monto, CBO.co_mone, CBO.cod_cta as cod_cta_ori,
		CBD.cod_cta as cod_cta_dest, BO.des_ban as des_ban_ori, BD.des_ban as des_ban_dest, CBO.num_cta as num_cta_ori,
		CBD.num_cta as num_cta_dest, TI.co_tipo_imag, TI.descrip, DI.co_imag, DI.des_imag, DI.rowguidDoc, DI.picture
		FROM            
			saTransferenciaEntreCuentas TEC
			LEFT JOIN saCuentaBancaria CBO ON CBO.cod_cta = TEC.cta_origen
			LEFT JOIN saCuentaBancaria CBD ON CBD.cod_cta = TEC.cta_destino
			LEFT JOIN saBanco BO ON BO.co_ban = CBO.co_ban
			LEFT JOIN saBanco BD ON BD.co_ban = CBD.co_ban			
			LEFT JOIN dbo.saDocumentoImagen DI ON DI.rowguidDoc = TEC.rowguid
			LEFT JOIN dbo.saTipoImagen TI ON TI.co_tipo_imag = DI.co_tipo_imag
        
		WHERE
			((@sCo_Trans_Ban_d IS NULL OR T
```
