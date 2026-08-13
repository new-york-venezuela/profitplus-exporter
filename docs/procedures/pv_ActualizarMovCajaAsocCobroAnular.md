# SP: pv_ActualizarMovCajaAsocCobroAnular
**Tipo**: PV-Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ActualizarMovCajaAsocCobroAnular]
*DESCRIPCIÓN	:	ACTUALIZA EL ESTADO A ANULADO = TRUE TODOS LOS MOVIMIENTOS DE CAJA 
					CUYO ORIGEN SEA UN COBRO CON EL NUMERO DEL PARAMETRO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarMovCajaAsocCobroAnular]
    (
		@sNro_Cobro		CHAR(20),
	    @sCo_Us_Mo		CHAR(6) ,
	    @sCo_Sucu_Mo	CHAR(6)				=	NULL ,
	    @sMaquina		VARCHAR(60)			=	NULL ,
	    @sCampos		VARCHAR(MAX)		=	NULL ,
	    @sRevisado		CHAR(1) ,
	    @sTrasnfe		CHAR(1) ,
	    @tsValidador	TIMESTAMP			=	NULL ,
	    @gRowguid		UNIQUEIDENTIFIER	=	NULL 
    )
AS 
    BEGIN

		DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

		Declare @sMovNum CHAR(20)
		Declare @sCodigo CHAR(6)
		Declare @sForma_Pag CHAR(2)
		Declare @sTipoSaldo CHAR(2)
		Declare @deMonto DECIMAL(18, 2)

		DECLARE MOV_ANULAR CURSOR LOCAL FAST_FORWARD
        FOR
            select cod_caja, forma_pag, monto_h, mov_num from saMovimientoCaja 
			where  mov_num in
				(select mov_num_c from saCobroTPReng where cob_num =@sNro_Cobro)
					and anulado = 0
        OPEN MOV_ANULAR

        FETCH NEXT FROM MOV_ANULAR 
			INTO @sCodigo, @sForma_Pag, @deMonto, @sMovNum

        WHILE @@FETCH_STATUS = 0 
            BEGIN
				set @deMonto = @deMonto * -1
				EXEC [pActualizarSaldoCaja] @sCodigo = @sCodigo,
								@sCodigoOri = @sCodigo,
								@sTipo = 'TF',
								@sTipoOri = 'TF',
								@deSaldo = @deMonto 
				
				IF @sForma_Pag = 'EF'
				Begin
					EXEC [pActualizarSaldoCaja] @sCodigo = @sCodigo,
								@sCodigoOri = @sCodigo,
								@sTipo = @sForma_Pag,
								@sTipoOri = @sForma_Pag,
								@deSaldo = @deMonto 
				End


				UPDATE  saMovimientoCaja
				SET anulado = 1
					 OUTPUT	inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
									INTO @TableTimestamp
				WHERE mov_num = @sMovNum

				DECLARE @dtFe_In DATETIME
				DECLARE @rowGuidOri UNIQUEIDENTIFIER

				SELECT
					@dtFe_In = fe_us_mo, @rowGuidOri = rowguid
				FROM
					@TableTimestamp

				IF @dtFe_In IS NOT NULL 
					BEGIN
				-- Insertar Pista
						EXEC [pInsertarPista] @sUsuario_Id = @sCo_U
```
