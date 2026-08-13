# SP: RepMovBancoTransfNomina
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <27-01-2017>
-- Description:	<Reporte de movimientos de banco transferidos desde nómina>
-- LAST DATE:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepMovBancoTransfNomina]
	@cCo_CodCuenta_d CHAR(6) = NULL,
	@cCo_CodCuenta_h CHAR(6) = NULL,
	@cNroTransNom_d int = NULL,
	@cNroTransNom_h int = NULL,
	@sFecha_d DateTime,
	@sFecha_h DateTime,
	@cConciliado CHAR(6) = NULL,
	@cSucur CHAR(6) = NULL ,
    @bHeaderRep     BIT = 0 
AS
BEGIN

	SET NOCOUNT ON;

	DECLARE @conc bit

	IF (@cConciliado = 'SIT ')
		SET  @conc = 1 
	ELSE 
		SET @conc = 0

	SELECT MB.origen, MB.nro_transf_nomi, MB.mov_num, CB.num_cta, MB.tipo_op, MB.doc_num, m.co_mone mone_des, MB.cob_pag recibo, MB.descrip,
			MB.monto_h * CASE when MB.tipo_op = 'ID' then 0 else 1 end as monto_h,
            MB.monto_d * CASE when MB.tipo_op = 'ID' then 0 else 1 end as monto_d, 
			(MB.idb + CASE when MB.tipo_op = 'ID' then monto_h + monto_d else 0 end ) * case when MB.monto_d > 0 then 1 else -1 end as idb
	FROM			saMovimientoBanco MB
		INNER JOIN	saCuentaBancaria CB		on	CB.cod_cta	=	MB.cod_cta
		INNER JOIN	saMoneda M				on	M.co_mone	=	CB.co_mone
	WHERE
		MB.origen = 'NOM' AND
        ( ( @cCo_CodCuenta_d IS NULL
            OR MB.cod_cta >= @cCo_CodCuenta_d
            )
            AND ( @cCo_CodCuenta_h IS NULL
                OR MB.cod_cta <= @cCo_CodCuenta_h
                )
        )
		AND
		( ( @cNroTransNom_d IS NULL
            OR MB.nro_transf_nomi >= @cNroTransNom_d
            )
            AND ( @cNroTransNom_h IS NULL
                OR MB.nro_transf_nomi <= @cNroTransNom_h
                )
        )
		AND 
		( ( @sFecha_d IS NULL
            OR dbo.FechaSimple(MB.fecha) >= @sFecha_d
            )
            AND ( @sFecha_h IS NULL
                OR dbo.FechaSimple(MB.fecha) <= @sFecha_h
                  )
       )
	   AND
	   ( @cConciliado IS NULL 
			OR MB.conciliado = @conc)
		
		AND 
		( @cSucur IS NULL
                  OR @cSucur = MB.co_sucu_in )
END
```
